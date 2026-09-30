package com.partigame.games.bulmaca;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Soru havuzundan kesişen bir bulmaca üretir. Her denemede kelimeler karıştırılır; ilk kelime ortaya
 * yatay konur, sonrakiler mevcut harflerle kesişecek şekilde en çok kesişim veren yere yerleştirilir.
 * Birçok deneme arasından en çok kelimeli, sonra en derli toplu olan seçilir.
 */
final class CrosswordGenerator {

    static final int TARGET_WORDS = 12;
    static final int MAX_DIM = 13;
    private static final int WORK = 31;
    private static final int ATTEMPTS = 40;

    private final Random random;

    CrosswordGenerator(Random random) {
        this.random = random;
    }

    Crossword generate(List<Clue> pool) {
        if (pool.isEmpty()) {
            throw new IllegalArgumentException("Soru havuzu boş");
        }
        Attempt best = null;
        for (int i = 0; i < ATTEMPTS; i++) {
            Attempt attempt = attempt(pool);
            if (best == null || attempt.betterThan(best)) {
                best = attempt;
            }
        }
        return best.toCrossword();
    }

    private Attempt attempt(List<Clue> pool) {
        List<Clue> words = new ArrayList<>(pool);
        Collections.shuffle(words, random);
        Attempt attempt = new Attempt();
        Clue first = words.stream()
                .filter(c -> c.cevap().length() >= 5 && c.cevap().length() <= 9)
                .findFirst().orElse(words.getFirst());
        attempt.place(first, WORK / 2, (WORK - first.cevap().length()) / 2, true);

        Set<String> used = new HashSet<>();
        used.add(first.cevap());
        // İlk turda yerleşemeyen kelimeler, sonradan eklenen harflerle ikinci turda yer bulabilir.
        for (int pass = 0; pass < 2 && attempt.placed.size() < TARGET_WORDS; pass++) {
            for (Clue clue : words) {
                if (attempt.placed.size() >= TARGET_WORDS) {
                    break;
                }
                if (used.contains(clue.cevap())) {
                    continue;
                }
                Placement p = attempt.bestPlacement(clue.cevap());
                if (p != null) {
                    attempt.place(clue, p.row, p.col, p.across);
                    used.add(clue.cevap());
                }
            }
        }
        return attempt;
    }

    private record Placement(int row, int col, boolean across, int score) {
    }

    private record Placed(Clue clue, int row, int col, boolean across) {
    }

    private final class Attempt {
        final char[][] grid = new char[WORK][WORK];
        /** Hücreden hangi yönde kelime geçtiği; aynı yönde üst üste binmeyi engeller. */
        final boolean[][] acrossUsed = new boolean[WORK][WORK];
        final boolean[][] downUsed = new boolean[WORK][WORK];
        final List<Placed> placed = new ArrayList<>();
        int minRow = WORK, maxRow = -1, minCol = WORK, maxCol = -1;
        int crossings;

        void place(Clue clue, int row, int col, boolean across) {
            String w = clue.cevap();
            for (int i = 0; i < w.length(); i++) {
                int r = across ? row : row + i;
                int c = across ? col + i : col;
                if (grid[r][c] != 0) {
                    crossings++;
                }
                grid[r][c] = w.charAt(i);
                (across ? acrossUsed : downUsed)[r][c] = true;
                minRow = Math.min(minRow, r);
                maxRow = Math.max(maxRow, r);
                minCol = Math.min(minCol, c);
                maxCol = Math.max(maxCol, c);
            }
            placed.add(new Placed(clue, row, col, across));
        }

        Placement bestPlacement(String word) {
            Placement best = null;
            for (Placed p : placed) {
                String other = p.clue().cevap();
                for (int i = 0; i < other.length(); i++) {
                    int cellR = p.across() ? p.row() : p.row() + i;
                    int cellC = p.across() ? p.col() + i : p.col();
                    for (int j = 0; j < word.length(); j++) {
                        if (word.charAt(j) != other.charAt(i)) {
                            continue;
                        }
                        boolean across = !p.across();
                        int row = across ? cellR : cellR - j;
                        int col = across ? cellC - j : cellC;
                        int score = score(word, row, col, across);
                        if (score > 0 && (best == null || score > best.score)) {
                            best = new Placement(row, col, across, score);
                        }
                    }
                }
            }
            return best;
        }

        /** Yerleştirme geçersizse 0, değilse kesişim ağırlıklı puan (derli toplu olan tercih edilir). */
        int score(String w, int row, int col, boolean across) {
            int len = w.length();
            int endRow = across ? row : row + len - 1;
            int endCol = across ? col + len - 1 : col;
            if (row < 1 || col < 1 || endRow >= WORK - 1 || endCol >= WORK - 1) {
                return 0;
            }
            int newMinR = Math.min(minRow, row), newMaxR = Math.max(maxRow, endRow);
            int newMinC = Math.min(minCol, col), newMaxC = Math.max(maxCol, endCol);
            if (newMaxR - newMinR + 1 > MAX_DIM || newMaxC - newMinC + 1 > MAX_DIM) {
                return 0;
            }
            // Kelimenin hemen önü ve arkası boş olmalı.
            int beforeR = across ? row : row - 1, beforeC = across ? col - 1 : col;
            int afterR = across ? row : endRow + 1, afterC = across ? endCol + 1 : col;
            if (grid[beforeR][beforeC] != 0 || grid[afterR][afterC] != 0) {
                return 0;
            }
            int crosses = 0;
            for (int i = 0; i < len; i++) {
                int r = across ? row : row + i;
                int c = across ? col + i : col;
                char existing = grid[r][c];
                if (existing != 0) {
                    boolean sameDirection = across ? acrossUsed[r][c] : downUsed[r][c];
                    if (existing != w.charAt(i) || sameDirection) {
                        return 0;
                    }
                    crosses++;
                } else {
                    // Yeni harfin yanları boş olmalı; yoksa istenmeyen kelimeler oluşur.
                    boolean sideTaken = across
                            ? grid[r - 1][c] != 0 || grid[r + 1][c] != 0
                            : grid[r][c - 1] != 0 || grid[r][c + 1] != 0;
                    if (sideTaken) {
                        return 0;
                    }
                }
            }
            if (crosses == 0 || crosses == len) {
                return 0;
            }
            int growth = (newMaxR - newMinR) * (newMaxC - newMinC) - (maxRow - minRow) * (maxCol - minCol);
            return 1000 + crosses * 100 - growth + random.nextInt(20);
        }

        boolean betterThan(Attempt other) {
            if (placed.size() != other.placed.size()) {
                return placed.size() > other.placed.size();
            }
            int area = (maxRow - minRow + 1) * (maxCol - minCol + 1);
            int otherArea = (other.maxRow - other.minRow + 1) * (other.maxCol - other.minCol + 1);
            if (area != otherArea) {
                return area < otherArea;
            }
            return crossings > other.crossings;
        }

        Crossword toCrossword() {
            List<Placed> sorted = new ArrayList<>(placed);
            sorted.sort(Comparator.<Placed>comparingInt(p -> p.row()).thenComparingInt(p -> p.col())
                    .thenComparing(p -> !p.across()));
            // Başlangıç hücrelerine okuma sırasıyla numara ver.
            Map<Long, Integer> numbers = new HashMap<>();
            for (Placed p : sorted) {
                numbers.computeIfAbsent(key(p.row(), p.col()), k -> numbers.size() + 1);
            }
            List<Crossword.Entry> entries = new ArrayList<>();
            for (Placed p : sorted) {
                entries.add(new Crossword.Entry(entries.size(), numbers.get(key(p.row(), p.col())), p.across(),
                        p.row() - minRow, p.col() - minCol, p.clue().cevap(), p.clue().ipucu()));
            }
            return new Crossword(maxRow - minRow + 1, maxCol - minCol + 1, entries);
        }

        private static long key(int row, int col) {
            return (long) row * WORK + col;
        }
    }
}
