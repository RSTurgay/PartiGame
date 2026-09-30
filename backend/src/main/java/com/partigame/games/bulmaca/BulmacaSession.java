package com.partigame.games.bulmaca;

import com.partigame.game.GameContext;
import com.partigame.game.GameMode;
import com.partigame.game.GameSession;
import com.partigame.game.PlayerInfo;
import com.partigame.game.PlayerResult;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.TreeMap;

/**
 * Sıralı ortak bulmaca. Sıradaki oyuncu (takım modunda takım) süresi içinde istediği kelimeleri çözer;
 * çözülen kelimeler herkes için açık kalır ve kesişen harfler sonraki oyuncuya ipucu olur.
 * Cevaplar istemciye hiç gönderilmez, kontrol sunucudadır.
 */
final class BulmacaSession implements GameSession {

    static final int HINT_COST = 3;
    static final int STREAK_BONUS = 2;
    private static final double INTRO_SECONDS = 3;
    private static final double SWITCH_SECONDS = 2.5;
    private static final double DONE_SECONDS = 4;
    /** Bulmaca bitmese de oyun en fazla bu kadar tam tur sürer. */
    static final int MAX_ROUNDS = 10;
    private static final int[] POINTS_BY_PLACE = {10, 7, 5, 3, 2, 1};
    private static final int MAX_GUESS_LENGTH = 16;

    enum Phase { INTRO, TURN, SWITCH, DONE }

    private final Crossword crossword;
    private final char[][] solution;
    private final boolean[][] revealed;
    private final Random random;
    private final double turnSeconds;
    private final Difficulty difficulty;
    private final List<PlayerInfo> players;
    /** Sıra grupları: tek oyunculu modlarda her oyuncu, takım modunda her takım bir grup. */
    private final List<List<String>> turnGroups = new ArrayList<>();
    /** Kelime id → çözen oyuncu; "" ise harf açılarak kendiliğinden tamamlandı. */
    private final Map<Integer, String> solvedBy = new HashMap<>();
    private final Map<String, Integer> points = new LinkedHashMap<>();
    private final Map<String, Integer> wordsSolved = new HashMap<>();
    private final List<Event> events = new ArrayList<>();

    private Phase phase = Phase.INTRO;
    private double phaseTimer = INTRO_SECONDS;
    private double timeLeft;
    /** Sıradaki grubun indeksi; her zaman 0..turnGroups.size()-1 aralığında. */
    private int turnIndex;
    private int round = 1;
    /** Bu turdaki art arda doğru sayısı (seri bonusu için). */
    private int streak;
    private boolean solvedThisRound;

    BulmacaSession(GameContext context, ClueBank bank, Random random) {
        this.random = random;
        this.players = context.players();
        this.turnSeconds = Double.parseDouble(context.option(BulmacaModule.OPTION_TIME, "60"));
        this.difficulty = Difficulty.valueOf(context.option(BulmacaModule.OPTION_DIFFICULTY, Difficulty.ORTA.name()));
        this.crossword = new CrosswordGenerator(random).generate(difficulty.pool(bank.all(), random));
        this.solution = crossword.solution();
        this.revealed = new boolean[crossword.rows()][crossword.cols()];
        buildTurnGroups(context.mode());
        players.forEach(p -> points.put(p.id(), 0));
    }

    private void buildTurnGroups(GameMode mode) {
        if (mode == GameMode.TEAMS) {
            Map<Integer, List<String>> byTeam = new TreeMap<>();
            players.forEach(p -> byTeam.computeIfAbsent(p.team(), t -> new ArrayList<>()).add(p.id()));
            turnGroups.addAll(byTeam.values());
        } else {
            players.forEach(p -> turnGroups.add(new ArrayList<>(List.of(p.id()))));
        }
    }

    @Override
    public Object initData() {
        List<WordView> words = crossword.entries().stream()
                .map(e -> new WordView(e.id(), e.number(), e.across(), e.row(), e.col(), e.length(), e.clue()))
                .toList();
        return new Init(crossword.rows(), crossword.cols(), words, (int) turnSeconds, difficulty.label, players);
    }

    @Override
    public void onInput(String playerId, Map<String, Object> input) {
        if (phase != Phase.TURN || !currentGroup().contains(playerId)) {
            return;
        }
        String action = String.valueOf(input.get("action"));
        switch (action) {
            case "answer" -> answer(playerId, wordId(input), String.valueOf(input.get("text")));
            case "hint" -> hint(playerId, wordId(input));
            case "pass" -> endTurn();
            default -> {
            }
        }
    }

    private static int wordId(Map<String, Object> input) {
        return input.get("word") instanceof Number n ? n.intValue() : -1;
    }

    private Crossword.Entry entry(int id) {
        return id >= 0 && id < crossword.entries().size() ? crossword.entries().get(id) : null;
    }

    private void answer(String playerId, int id, String text) {
        Crossword.Entry e = entry(id);
        if (e == null || solvedBy.containsKey(id)) {
            return;
        }
        String guess = TurkishText.normalize(text);
        if (guess.isEmpty()) {
            return;
        }
        if (guess.equals(e.answer())) {
            int gained = e.length() + streak * STREAK_BONUS;
            streak++;
            solvedThisRound = true;
            points.merge(playerId, gained, Integer::sum);
            wordsSolved.merge(playerId, 1, Integer::sum);
            solve(e, playerId);
            events.add(new Event("solved", playerId, id, null, gained));
            if (allSolved()) {
                finish();
            }
        } else {
            String shown = guess.length() > MAX_GUESS_LENGTH ? guess.substring(0, MAX_GUESS_LENGTH) : guess;
            events.add(new Event("wrong", playerId, id, shown, 0));
        }
    }

    /** "Harf al" jokeri: kelimede açılmamış rastgele bir harf açar, puan düşer (sıfırın altına inmez). */
    private void hint(String playerId, int id) {
        Crossword.Entry e = entry(id);
        if (e == null || solvedBy.containsKey(id)) {
            return;
        }
        if (revealRandomLetter(e)) {
            points.merge(playerId, -HINT_COST, (a, b) -> Math.max(0, a + b));
            events.add(new Event("hint", playerId, id, null, -HINT_COST));
            if (allSolved()) {
                finish();
            }
        }
    }

    /** Açılmamış bir harf açar; kelime tamamen açıldıysa (kimse puan almadan) çözülmüş sayılır. */
    private boolean revealRandomLetter(Crossword.Entry e) {
        List<Integer> hidden = new ArrayList<>();
        for (int i = 0; i < e.length(); i++) {
            if (!revealed[e.rowAt(i)][e.colAt(i)]) {
                hidden.add(i);
            }
        }
        if (hidden.isEmpty()) {
            return false;
        }
        int i = hidden.get(random.nextInt(hidden.size()));
        revealed[e.rowAt(i)][e.colAt(i)] = true;
        markCompletedWords();
        return true;
    }

    private void solve(Crossword.Entry e, String playerId) {
        solvedBy.put(e.id(), playerId);
        for (int i = 0; i < e.length(); i++) {
            revealed[e.rowAt(i)][e.colAt(i)] = true;
        }
        markCompletedWords();
    }

    /** Kesişimlerden tüm harfleri açılmış kelimeler kendiliğinden tamamlanır (puan yok). */
    private void markCompletedWords() {
        for (Crossword.Entry e : crossword.entries()) {
            if (solvedBy.containsKey(e.id())) {
                continue;
            }
            boolean complete = true;
            for (int i = 0; i < e.length() && complete; i++) {
                complete = revealed[e.rowAt(i)][e.colAt(i)];
            }
            if (complete) {
                solvedBy.put(e.id(), "");
            }
        }
    }

    private boolean allSolved() {
        return solvedBy.size() == crossword.entries().size();
    }

    private List<String> currentGroup() {
        return turnGroups.isEmpty() ? List.of() : turnGroups.get(turnIndex);
    }

    @Override
    public void onPlayerLeft(String playerId) {
        for (int g = 0; g < turnGroups.size(); g++) {
            List<String> group = turnGroups.get(g);
            if (!group.remove(playerId) || !group.isEmpty()) {
                continue;
            }
            // Grup boşaldı: listeden çıkar, sıra göstergesini aynı gruba bakacak şekilde kaydır.
            turnGroups.remove(g);
            boolean wasCurrent = g == turnIndex;
            if (g < turnIndex) {
                turnIndex--;
            }
            if (turnIndex >= turnGroups.size()) {
                turnIndex = 0;
            }
            if (turnGroups.isEmpty()) {
                finish();
            } else if (wasCurrent && phase == Phase.TURN) {
                // Sırası olan grup ayrıldı; sıra kendiliğinden bir sonraki gruba geçti.
                startSwitch();
            }
            return;
        }
    }

    @Override
    public void update(double dt) {
        switch (phase) {
            case INTRO -> {
                phaseTimer -= dt;
                if (phaseTimer <= 0) {
                    startTurn();
                }
            }
            case TURN -> {
                timeLeft -= dt;
                if (timeLeft <= 0) {
                    endTurn();
                }
            }
            case SWITCH -> {
                phaseTimer -= dt;
                if (phaseTimer <= 0) {
                    startTurn();
                }
            }
            case DONE -> phaseTimer -= dt;
        }
    }

    private void startTurn() {
        phase = Phase.TURN;
        timeLeft = turnSeconds;
        streak = 0;
        events.add(new Event("turn", String.join(",", currentGroup()), -1, null, 0));
    }

    private void endTurn() {
        turnIndex++;
        if (turnIndex >= turnGroups.size()) {
            turnIndex = 0;
            // Tam tur bitti. Kimse bir şey çözemediyse takılmayı önlemek için her kelimede bir harf aç.
            if (!solvedThisRound) {
                crossword.entries().stream()
                        .filter(e -> !solvedBy.containsKey(e.id()))
                        .forEach(this::revealRandomLetter);
                events.add(new Event("reveal", "", -1, null, 0));
            }
            solvedThisRound = false;
            round++;
        }
        if (allSolved() || round > MAX_ROUNDS) {
            finish();
        } else {
            startSwitch();
        }
    }

    private void startSwitch() {
        phase = Phase.SWITCH;
        phaseTimer = SWITCH_SECONDS;
    }

    private void finish() {
        if (phase != Phase.DONE) {
            phase = Phase.DONE;
            phaseTimer = DONE_SECONDS;
            // Bitişte tüm cevaplar gösterilir.
            for (boolean[] row : revealed) {
                Arrays.fill(row, true);
            }
        }
    }

    @Override
    public Object snapshot() {
        List<String> grid = new ArrayList<>(crossword.rows());
        for (int r = 0; r < crossword.rows(); r++) {
            StringBuilder sb = new StringBuilder(crossword.cols());
            for (int c = 0; c < crossword.cols(); c++) {
                char ch = solution[r][c];
                sb.append(ch == 0 ? '#' : revealed[r][c] ? ch : '_');
            }
            grid.add(sb.toString());
        }
        List<String> solved = new ArrayList<>(crossword.entries().size());
        for (Crossword.Entry e : crossword.entries()) {
            solved.add(solvedBy.get(e.id()));
        }
        List<Score> scores = players.stream()
                .filter(p -> points.containsKey(p.id()))
                .map(p -> new Score(p.id(), points.get(p.id()), wordsSolved.getOrDefault(p.id(), 0)))
                .toList();
        List<Event> drained = List.copyOf(events);
        events.clear();
        double timer = phase == Phase.TURN ? timeLeft : phaseTimer;
        return new Snapshot(phase.name(), round, List.copyOf(currentGroup()), round(Math.max(0, timer)),
                grid, solved, scores, drained);
    }

    private static double round(double v) {
        return Math.round(v * 10) / 10.0;
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.DONE && phaseTimer <= 0;
    }

    @Override
    public List<PlayerResult> results() {
        List<String> ordered = new ArrayList<>(points.keySet());
        ordered.sort(Comparator.<String>comparingInt(id -> points.get(id)).reversed()
                .thenComparing(Comparator.<String>comparingInt(id -> wordsSolved.getOrDefault(id, 0)).reversed()));
        List<PlayerResult> results = new ArrayList<>();
        for (int i = 0; i < ordered.size(); i++) {
            String id = ordered.get(i);
            int party = i < POINTS_BY_PLACE.length ? POINTS_BY_PLACE[i] : 0;
            results.add(new PlayerResult(id, i + 1, party,
                    points.get(id) + " puan · " + wordsSolved.getOrDefault(id, 0) + " kelime"));
        }
        return results;
    }

    // ---- Testler için ----

    Crossword crossword() {
        return crossword;
    }

    Phase phase() {
        return phase;
    }

    int points(String playerId) {
        return points.getOrDefault(playerId, 0);
    }

    // ---- İstemciye giden veriler (frontend games/bulmaca/types.ts ile eşleşir) ----

    /** Cevaplar yok: sadece yer, uzunluk ve ipucu. */
    record WordView(int id, int number, boolean across, int row, int col, int length, String clue) {
    }

    record Init(int rows, int cols, List<WordView> words, int turnSeconds, String difficulty,
                List<PlayerInfo> players) {
    }

    /**
     * {@code grid}: satır başına metin; '#' boş hücre, '_' açılmamış harf, diğerleri açık harf.
     * {@code solvedBy}: kelime sırasıyla çözen oyuncu, "" kendiliğinden tamamlandı, null çözülmedi.
     * {@code turn}: sıradaki oyuncu(lar). {@code timer}: TURN'de kalan süre, diğer fazlarda faz süresi.
     */
    record Snapshot(String phase, int round, List<String> turn, double timer, List<String> grid,
                    List<String> solvedBy, List<Score> scores, List<Event> events) {
    }

    record Score(String playerId, int points, int words) {
    }

    /**
     * {@code type}: solved, wrong (guess: yanlış tahmin), hint, turn (playerId: virgülle ayrılmış sıradakiler),
     * reveal (tur sonunda otomatik harf açıldı). {@code points}: kazanılan/kaybedilen puan.
     */
    record Event(String type, String playerId, int word, String guess, int points) {
    }
}
