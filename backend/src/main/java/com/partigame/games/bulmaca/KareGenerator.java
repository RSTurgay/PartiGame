package com.partigame.games.bulmaca;

import java.util.ArrayList;
import java.util.BitSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Gazetedeki gibi tamamen dolu kare bulmaca üretir. Izgaranın her hücresi ya harf, ya soru kutusu,
 * ya da sol üstteki resim alanıdır. Her kelimenin sorusu, kelimenin hemen solundaki (soldan sağa)
 * ya da hemen üstündeki (yukarıdan aşağıya) soru kutusunda durur; resmin cevabı resmin sağındaki satırdır.
 *
 * <p>Önce rastgele bir şablon kurulur ve kurallar sağlanana kadar düzeltilir; sonra kelimeler kısıt
 * tatmini (en az seçeneği olan yer önce, geri dönüşlü arama) ile yerleştirilir. Doldurulamazsa yeni şablon denenir.
 */
final class KareGenerator {

    static final int ROWS = 9;
    static final int COLS = 12;
    /** Sol üstteki resim alanı IMAGE×IMAGE hücre. */
    static final int IMAGE = 3;
    static final int MAX_RUN = 7;
    private static final double CLUE_DENSITY = 0.2;
    private static final int REPAIR_ROUNDS = 60;
    private static final long TIME_BUDGET_MS = 6000;
    private static final int NODE_BUDGET = 40_000;
    /** Bir yere denenecek en fazla aday kelime; aramanın patlamasını önler. */
    private static final int MAX_CANDIDATES = 25;

    static final char LETTER = 'L';
    static final char CLUE = 'C';
    static final char IMG = 'I';

    private final Random random;
    private final WordIndex index;
    private final Map<String, List<String>> clues;

    /** @param clues cevap → olası ipuçları (aynı cevabın birden çok ipucu olabilir) */
    KareGenerator(Random random, Map<String, List<String>> clues) {
        this.random = random;
        this.clues = clues;
        this.index = new WordIndex(clues.keySet());
    }

    /** @return üretilen bulmaca; süre içinde doldurulamazsa null */
    Crossword generate(Picture picture) {
        long deadline = System.currentTimeMillis() + TIME_BUDGET_MS;
        while (System.currentTimeMillis() < deadline) {
            char[][] layout = template(picture.answer().length());
            if (layout == null) {
                continue;
            }
            Crossword result = fill(layout, picture, deadline);
            if (result != null) {
                return result;
            }
        }
        return null;
    }

    // ---------------- Şablon ----------------

    char[][] template(int pictureLength) {
        char[][] g = new char[ROWS][COLS];
        boolean[][] fixed = new boolean[ROWS][COLS];
        for (int r = 0; r < ROWS; r++) {
            for (int c = 0; c < COLS; c++) {
                if (r < IMAGE && c < IMAGE) {
                    g[r][c] = IMG;
                    fixed[r][c] = true;
                } else if (r == 0 || c == 0) {
                    g[r][c] = CLUE;
                    fixed[r][c] = true;
                } else {
                    g[r][c] = random.nextDouble() < CLUE_DENSITY ? CLUE : LETTER;
                }
            }
        }
        // Resmin cevabı: resmin sağında, 1. satırda.
        int end = IMAGE + pictureLength;
        if (end > COLS) {
            return null;
        }
        for (int c = IMAGE; c < end; c++) {
            g[1][c] = LETTER;
            fixed[1][c] = true;
        }
        if (end < COLS) {
            g[1][end] = CLUE;
            fixed[1][end] = true;
        }
        // Resmin altındaki ve sağındaki kelimelerin sorusu için kutular.
        for (int[] cell : new int[][]{{2, IMAGE}, {IMAGE, 1}, {IMAGE, 2}}) {
            g[cell[0]][cell[1]] = CLUE;
            fixed[cell[0]][cell[1]] = true;
        }

        for (int round = 0; round < REPAIR_ROUNDS; round++) {
            if (!repair(g, fixed)) {
                return valid(g) ? g : null;
            }
        }
        return null;
    }

    /** Kurallara uymayan ilk durumu düzeltir; düzeltecek bir şey kalmadıysa false. */
    private boolean repair(char[][] g, boolean[][] fixed) {
        // 1) Çok uzun kelime yerlerini böl (resmin cevabı hariç; o sabit).
        for (boolean across : new boolean[]{true, false}) {
            for (int[] run : runs(g, across)) {
                if (run[2] > MAX_RUN && !isPictureRun(run, across)) {
                    int offset = 2 + random.nextInt(run[2] - 4);
                    int r = across ? run[0] : run[0] + offset;
                    int c = across ? run[1] + offset : run[1];
                    if (!fixed[r][c]) {
                        g[r][c] = CLUE;
                        return true;
                    }
                    // Sabit hücreye denk geldiyse bir yanındakini dene.
                    int r2 = across ? r : r + 1;
                    int c2 = across ? c + 1 : c;
                    if (!fixed[r2][c2]) {
                        g[r2][c2] = CLUE;
                        return true;
                    }
                }
            }
        }
        // 2) Hiçbir kelimeye ait olmayan harfi soru kutusu yap.
        for (int r = 1; r < ROWS; r++) {
            for (int c = 1; c < COLS; c++) {
                if (g[r][c] == LETTER && !fixed[r][c]
                        && runLength(g, r, c, true) < 2 && runLength(g, r, c, false) < 2) {
                    g[r][c] = CLUE;
                    return true;
                }
            }
        }
        // 3) Hiç soru taşımayan iç kutuyu harfe çevir.
        for (int r = 1; r < ROWS; r++) {
            for (int c = 1; c < COLS; c++) {
                if (g[r][c] == CLUE && !fixed[r][c] && !hasClue(g, r, c)) {
                    g[r][c] = LETTER;
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean isPictureRun(int[] run, boolean across) {
        return across && run[0] == 1 && run[1] == IMAGE;
    }

    private boolean valid(char[][] g) {
        for (boolean across : new boolean[]{true, false}) {
            for (int[] run : runs(g, across)) {
                if (run[2] > MAX_RUN && !isPictureRun(run, across)) {
                    return false;
                }
            }
        }
        for (int r = 0; r < ROWS; r++) {
            for (int c = 0; c < COLS; c++) {
                if (g[r][c] == LETTER && runLength(g, r, c, true) < 2 && runLength(g, r, c, false) < 2) {
                    return false;
                }
            }
        }
        return true;
    }

    /** Kutunun sağından ya da altından en az 2 harflik bir kelime başlıyor mu? */
    static boolean hasClue(char[][] g, int r, int c) {
        return (c + 1 < COLS && g[r][c + 1] == LETTER && runLength(g, r, c + 1, true) >= 2)
                || (r + 1 < ROWS && g[r + 1][c] == LETTER && runLength(g, r + 1, c, false) >= 2);
    }

    /** Hücrenin içinde bulunduğu harf dizisinin uzunluğu. */
    static int runLength(char[][] g, int r, int c, boolean across) {
        int start = across ? c : r;
        while (start > 0 && (across ? g[r][start - 1] : g[start - 1][c]) == LETTER) {
            start--;
        }
        int end = across ? c : r;
        int limit = across ? COLS : ROWS;
        while (end + 1 < limit && (across ? g[r][end + 1] : g[end + 1][c]) == LETTER) {
            end++;
        }
        return end - start + 1;
    }

    /** Her biri {satır, sütun, uzunluk}: 2+ harflik kesintisiz diziler. */
    static List<int[]> runs(char[][] g, boolean across) {
        List<int[]> result = new ArrayList<>();
        int outer = across ? ROWS : COLS;
        int inner = across ? COLS : ROWS;
        for (int o = 0; o < outer; o++) {
            int start = -1;
            for (int i = 0; i <= inner; i++) {
                boolean letter = i < inner && (across ? g[o][i] : g[i][o]) == LETTER;
                if (letter && start < 0) {
                    start = i;
                } else if (!letter && start >= 0) {
                    if (i - start >= 2) {
                        result.add(across ? new int[]{o, start, i - start} : new int[]{start, o, i - start});
                    }
                    start = -1;
                }
            }
        }
        return result;
    }

    // ---------------- Doldurma ----------------

    private record Slot(int row, int col, int length, boolean across, int clueRow, int clueCol) {
        int r(int i) {
            return across ? row : row + i;
        }

        int c(int i) {
            return across ? col + i : col;
        }
    }

    private Crossword fill(char[][] layout, Picture picture, long deadline) {
        List<Slot> slots = new ArrayList<>();
        for (boolean across : new boolean[]{true, false}) {
            for (int[] run : runs(layout, across)) {
                int clueRow = across ? run[0] : run[0] - 1;
                int clueCol = across ? run[1] - 1 : run[1];
                slots.add(new Slot(run[0], run[1], run[2], across, clueRow, clueCol));
            }
        }
        Slot pictureSlot = slots.stream().filter(s -> s.across() && s.row() == 1 && s.col() == IMAGE)
                .findFirst().orElseThrow();
        for (Slot s : slots) {
            if (s != pictureSlot && index.count(s.length()) == 0) {
                return null;
            }
        }

        char[][] letters = new char[ROWS][COLS];
        String[] assigned = new String[slots.size()];
        Set<String> used = new HashSet<>();
        int pictureId = slots.indexOf(pictureSlot);
        place(pictureSlot, picture.answer(), letters);
        assigned[pictureId] = picture.answer();
        used.add(picture.answer());

        Search search = new Search(slots, letters, assigned, used, deadline);
        if (!search.solve()) {
            return null;
        }
        return build(layout, slots, assigned, pictureId, picture);
    }

    private static void place(Slot s, String word, char[][] letters) {
        for (int i = 0; i < s.length(); i++) {
            letters[s.r(i)][s.c(i)] = word.charAt(i);
        }
    }

    private final class Search {
        final List<Slot> slots;
        final char[][] letters;
        final String[] assigned;
        final Set<String> used;
        final long deadline;
        int nodes;

        Search(List<Slot> slots, char[][] letters, String[] assigned, Set<String> used, long deadline) {
            this.slots = slots;
            this.letters = letters;
            this.assigned = assigned;
            this.used = used;
            this.deadline = deadline;
        }

        BitSet candidates(Slot s) {
            char[] pattern = new char[s.length()];
            for (int i = 0; i < s.length(); i++) {
                pattern[i] = letters[s.r(i)][s.c(i)];
            }
            return index.matching(pattern);
        }

        boolean solve() {
            if (++nodes > NODE_BUDGET || (nodes % 256 == 0 && System.currentTimeMillis() > deadline)) {
                return false;
            }
            // En az seçeneği olan boş yeri seç (MRV).
            int best = -1;
            BitSet bestSet = null;
            int bestCount = Integer.MAX_VALUE;
            for (int i = 0; i < slots.size(); i++) {
                if (assigned[i] != null) {
                    continue;
                }
                BitSet set = candidates(slots.get(i));
                int count = set.cardinality();
                if (count == 0) {
                    return false;
                }
                if (count < bestCount) {
                    best = i;
                    bestSet = set;
                    bestCount = count;
                }
            }
            if (best < 0) {
                return true;
            }
            Slot slot = slots.get(best);
            List<Integer> ids = new ArrayList<>(bestCount);
            for (int id = bestSet.nextSetBit(0); id >= 0; id = bestSet.nextSetBit(id + 1)) {
                ids.add(id);
            }
            java.util.Collections.shuffle(ids, random);
            int tried = 0;
            for (int id : ids) {
                String word = index.word(slot.length(), id);
                if (used.contains(word)) {
                    continue;
                }
                if (++tried > MAX_CANDIDATES) {
                    break;
                }
                char[] previous = new char[slot.length()];
                for (int i = 0; i < slot.length(); i++) {
                    previous[i] = letters[slot.r(i)][slot.c(i)];
                }
                place(slot, word, letters);
                assigned[best] = word;
                used.add(word);
                if (solve()) {
                    return true;
                }
                used.remove(word);
                assigned[best] = null;
                for (int i = 0; i < slot.length(); i++) {
                    letters[slot.r(i)][slot.c(i)] = previous[i];
                }
                if (nodes > NODE_BUDGET) {
                    return false;
                }
            }
            return false;
        }
    }

    private Crossword build(char[][] layout, List<Slot> slots, String[] assigned, int pictureId, Picture picture) {
        List<Crossword.Entry> entries = new ArrayList<>();
        // Okuma sırası: soru kutusunun yerine göre; aynı kutuda önce soldan sağa.
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < slots.size(); i++) {
            order.add(i);
        }
        order.sort((a, b) -> {
            Slot x = slots.get(a), y = slots.get(b);
            if (x.clueRow() != y.clueRow()) {
                return Integer.compare(x.clueRow(), y.clueRow());
            }
            if (x.clueCol() != y.clueCol()) {
                return Integer.compare(x.clueCol(), y.clueCol());
            }
            return Boolean.compare(!x.across(), !y.across());
        });
        Map<Integer, Integer> numbers = new HashMap<>();
        for (int i : order) {
            Slot s = slots.get(i);
            String answer = assigned[i];
            boolean isPicture = i == pictureId;
            String clue = isPicture ? picture.question() : pickClue(answer);
            int number = numbers.computeIfAbsent(s.clueRow() * COLS + s.clueCol(), k -> numbers.size() + 1);
            entries.add(new Crossword.Entry(entries.size(), number, s.across(), s.row(), s.col(), answer, clue,
                    isPicture ? -1 : s.clueRow(), isPicture ? -1 : s.clueCol()));
        }
        List<String> rows = new ArrayList<>();
        for (char[] row : layout) {
            rows.add(new String(row));
        }
        return new Crossword(ROWS, COLS, entries, rows, picture);
    }

    private String pickClue(String answer) {
        List<String> options = clues.get(answer);
        return options.get(random.nextInt(options.size()));
    }
}
