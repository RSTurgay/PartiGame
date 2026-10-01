package com.partigame.games.bulmaca;

import java.util.List;

/**
 * Üretilmiş bir bulmaca. İki tip vardır:
 * <ul>
 *   <li>Klasik: kelimeler boşlukta kesişir, ipuçları yanda numaralı listededir ({@code layout} null).</li>
 *   <li>Kare (gazete tipi): ızgara tamamen doludur; {@code layout} her hücrenin türünü verir
 *       ('L' harf, 'C' soru kutusu, 'I' resim). Her kelimenin sorusu {@code clueRow/clueCol} kutusundadır;
 *       resmin cevabının sorusu resmin kendisidir (clueRow = -1).</li>
 * </ul>
 */
record Crossword(int rows, int cols, List<Entry> entries, List<String> layout, Picture picture) {

    Crossword(int rows, int cols, List<Entry> entries) {
        this(rows, cols, entries, null, null);
    }

    boolean kare() {
        return layout != null;
    }

    /** {@code across}: true soldan sağa, false yukarıdan aşağıya. */
    record Entry(int id, int number, boolean across, int row, int col, String answer, String clue,
                 int clueRow, int clueCol) {

        Entry(int id, int number, boolean across, int row, int col, String answer, String clue) {
            this(id, number, across, row, col, answer, clue, -1, -1);
        }

        int length() {
            return answer.length();
        }

        int rowAt(int i) {
            return across ? row : row + i;
        }

        int colAt(int i) {
            return across ? col + i : col;
        }
    }

    /** Harfli hücrelerde harf, boş hücrelerde 0. */
    char[][] solution() {
        char[][] grid = new char[rows][cols];
        for (Entry e : entries) {
            for (int i = 0; i < e.length(); i++) {
                grid[e.rowAt(i)][e.colAt(i)] = e.answer().charAt(i);
            }
        }
        return grid;
    }
}
