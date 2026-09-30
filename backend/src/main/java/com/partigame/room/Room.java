package com.partigame.room;

import com.partigame.game.GameContext;
import com.partigame.game.GameMode;
import com.partigame.game.GameModule;
import com.partigame.game.GameOption;
import com.partigame.game.GameSession;
import com.partigame.game.PlayerInfo;
import com.partigame.game.PlayerResult;
import com.partigame.room.Messages.PlayerView;
import com.partigame.room.Messages.ResultView;
import com.partigame.room.Messages.RoomView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

/**
 * Bir parti odası. Oyuncular, seçili oyun ve parti puan tablosu burada tutulur.
 * Tüm durum değişiklikleri {@code synchronized} metotlarla yapılır; oyun döngüsü de aynı kilidi kullanır.
 */
public class Room {

    public static final int MAX_PLAYERS = 8;
    private static final int TEAM_SIZE = 2;
    private static final int MAX_TEAMS = MAX_PLAYERS / TEAM_SIZE;
    private static final long TICK_MILLIS = 1000 / 30;
    private static final String[] COLORS = {
            "#ff5a5f", "#3ea6ff", "#48d597", "#ffc93c", "#b57bff", "#ff8a3d", "#2ee6d6", "#ff6fb5"
    };

    private static final Logger log = LoggerFactory.getLogger(Room.class);

    private final String code;
    private final ScheduledExecutorService scheduler;
    private final Function<String, GameModule> gameLookup;
    private final Runnable onEmpty;

    private final Map<String, Player> players = new LinkedHashMap<>();
    private final Map<String, Integer> scores = new HashMap<>();
    private String hostId;
    private GameModule game;
    private GameMode mode = GameMode.FFA;
    /** Seçili oyunun ayarları; oyun değişince varsayılanlara döner. */
    private final Map<String, String> options = new HashMap<>();
    private RoomPhase phase = RoomPhase.LOBBY;
    private GameSession session;
    private ScheduledFuture<?> ticker;
    private long lastTickNanos;
    private List<ResultView> lastResults = List.of();
    private boolean closed;

    Room(String code, GameModule defaultGame, Function<String, GameModule> gameLookup,
         ScheduledExecutorService scheduler, Runnable onEmpty) {
        this.code = code;
        this.game = defaultGame;
        resetOptions();
        this.gameLookup = gameLookup;
        this.scheduler = scheduler;
        this.onEmpty = onEmpty;
    }

    public String code() {
        return code;
    }

    public synchronized void join(Player player) {
        if (closed) {
            throw new GameException("Oda kapandı.");
        }
        if (phase == RoomPhase.PLAYING) {
            throw new GameException("Oyun devam ediyor, bitince tekrar dene.");
        }
        if (players.size() >= MAX_PLAYERS) {
            throw new GameException("Oda dolu.");
        }
        player.setColor(freeColor());
        players.put(player.id(), player);
        scores.putIfAbsent(player.id(), 0);
        if (hostId == null) {
            hostId = player.id();
        }
        assignTeams();
        player.send(new Messages.Joined(code, player.id()));
        broadcastRoom();
    }

    public synchronized void leave(String playerId) {
        if (players.remove(playerId) == null) {
            return;
        }
        if (players.isEmpty()) {
            stopTicker();
            session = null;
            closed = true;
            onEmpty.run();
            return;
        }
        if (playerId.equals(hostId)) {
            hostId = players.keySet().iterator().next();
        }
        if (session != null) {
            session.onPlayerLeft(playerId);
        } else {
            assignTeams();
        }
        broadcastRoom();
    }

    public synchronized void selectGame(String playerId, String gameId, GameMode newMode) {
        requireHost(playerId);
        requirePhase(RoomPhase.LOBBY);
        GameModule selected = gameId == null ? game : gameLookup.apply(gameId);
        if (selected == null) {
            throw new GameException("Böyle bir oyun yok.");
        }
        GameMode selectedMode = newMode == null ? mode : newMode;
        if (!selected.supportedModes().contains(selectedMode)) {
            selectedMode = selected.supportedModes().iterator().next();
        }
        if (selected != game) {
            game = selected;
            resetOptions();
        }
        mode = selectedMode;
        assignTeams();
        broadcastRoom();
    }

    public synchronized void setOption(String playerId, String key, String value) {
        requireHost(playerId);
        requirePhase(RoomPhase.LOBBY);
        GameOption option = game.options().stream().filter(o -> o.key().equals(key)).findFirst()
                .orElseThrow(() -> new GameException("Bu oyunda böyle bir ayar yok."));
        if (!option.allows(value)) {
            throw new GameException("Geçersiz seçim.");
        }
        options.put(key, value);
        broadcastRoom();
    }

    private void resetOptions() {
        options.clear();
        game.options().forEach(o -> options.put(o.key(), o.defaultValue()));
    }

    public synchronized void setTeam(String playerId, int team) {
        requirePhase(RoomPhase.LOBBY);
        if (mode != GameMode.TEAMS) {
            throw new GameException("Takım seçimi sadece takım modunda yapılabilir.");
        }
        if (team < 1 || team > MAX_TEAMS) {
            throw new GameException("Geçersiz takım.");
        }
        Player player = players.get(playerId);
        if (player == null || player.team() == team) {
            return;
        }
        if (teamSize(team) >= TEAM_SIZE) {
            throw new GameException("Bu takım dolu.");
        }
        player.setTeam(team);
        broadcastRoom();
    }

    public synchronized void start(String playerId) {
        requireHost(playerId);
        requirePhase(RoomPhase.LOBBY);
        validatePlayerCount();

        List<PlayerInfo> infos = players.values().stream().map(Player::info).toList();
        session = game.createSession(new GameContext(mode, infos, Map.copyOf(options)));
        phase = RoomPhase.PLAYING;
        broadcast(new Messages.GameStarted(game.id(), mode, session.initData()));
        broadcastRoom();

        lastTickNanos = System.nanoTime();
        ticker = scheduler.scheduleAtFixedRate(this::tick, TICK_MILLIS, TICK_MILLIS, TimeUnit.MILLISECONDS);
    }

    public synchronized void backToLobby(String playerId) {
        requireHost(playerId);
        requirePhase(RoomPhase.RESULTS);
        phase = RoomPhase.LOBBY;
        assignTeams();
        broadcastRoom();
    }

    public synchronized void input(String playerId, Map<String, Object> input) {
        if (session != null && input != null) {
            session.onInput(playerId, input);
        }
    }

    private synchronized void tick() {
        if (session == null) {
            return;
        }
        try {
            long now = System.nanoTime();
            double dt = Math.min((now - lastTickNanos) / 1e9, 0.1);
            lastTickNanos = now;

            session.update(dt);
            broadcast(new Messages.GameState(session.snapshot()));
            if (session.isFinished()) {
                finishGame();
            }
        } catch (RuntimeException e) {
            log.error("Oda {} oyun döngüsünde hata, oyun iptal ediliyor", code, e);
            stopTicker();
            session = null;
            phase = RoomPhase.LOBBY;
            broadcast(new Messages.Error("Oyunda bir hata oluştu, lobiye dönüldü."));
            broadcastRoom();
        }
    }

    private void finishGame() {
        stopTicker();
        List<ResultView> results = new ArrayList<>();
        for (PlayerResult r : session.results()) {
            Player p = players.get(r.playerId());
            if (p == null) {
                continue;
            }
            scores.merge(p.id(), r.points(), Integer::sum);
            results.add(new ResultView(p.id(), p.name(), p.color(), p.team(), r.place(), r.points(), r.detail()));
        }
        session = null;
        lastResults = results;
        phase = RoomPhase.RESULTS;
        broadcast(new Messages.GameEnded(results));
        broadcastRoom();
    }

    private void validatePlayerCount() {
        int n = players.size();
        if (n < game.minPlayers() || n > game.maxPlayers()) {
            throw new GameException(game.name() + " için " + game.minPlayers() + "-" + game.maxPlayers()
                    + " oyuncu gerekli.");
        }
        switch (mode) {
            case DUEL -> {
                if (n != 2) {
                    throw new GameException("Düello için tam 2 oyuncu gerekli.");
                }
            }
            case TEAMS -> {
                long teamCount = players.values().stream().map(Player::team).distinct().count();
                if (teamCount < 2) {
                    throw new GameException("Takım modu için en az 2 takım gerekli.");
                }
            }
            case FFA -> {
            }
        }
    }

    /** Takım modunda takımı olmayanları en boş takıma yerleştirir; diğer modlarda takımları sıfırlar. */
    private void assignTeams() {
        if (mode != GameMode.TEAMS) {
            players.values().forEach(p -> p.setTeam(0));
            return;
        }
        for (Player p : players.values()) {
            if (p.team() == 0) {
                p.setTeam(bestTeam());
            }
        }
    }

    /** Önce bir kişilik takımları doldurur, sonra yeni takım açar. */
    private int bestTeam() {
        for (int t = 1; t <= MAX_TEAMS; t++) {
            if (teamSize(t) == 1) {
                return t;
            }
        }
        for (int t = 1; t <= MAX_TEAMS; t++) {
            if (teamSize(t) == 0) {
                return t;
            }
        }
        return 1;
    }

    private int teamSize(int team) {
        return (int) players.values().stream().filter(p -> p.team() == team).count();
    }

    private String freeColor() {
        for (String c : COLORS) {
            if (players.values().stream().noneMatch(p -> c.equals(p.color()))) {
                return c;
            }
        }
        return COLORS[0];
    }

    private void requireHost(String playerId) {
        if (!playerId.equals(hostId)) {
            throw new GameException("Bunu sadece oda sahibi yapabilir.");
        }
    }

    private void requirePhase(RoomPhase expected) {
        if (phase != expected) {
            throw new GameException("Şu an bu işlem yapılamaz.");
        }
    }

    private void stopTicker() {
        if (ticker != null) {
            ticker.cancel(false);
            ticker = null;
        }
    }

    private void broadcastRoom() {
        List<PlayerView> views = players.values().stream()
                .map(p -> new PlayerView(p.id(), p.name(), p.color(), p.team(), scores.getOrDefault(p.id(), 0)))
                .toList();
        broadcast(new Messages.RoomState(
                new RoomView(code, hostId, phase, game.id(), mode, Map.copyOf(options), views, lastResults)));
    }

    private void broadcast(Object message) {
        players.values().forEach(p -> p.send(message));
    }
}
