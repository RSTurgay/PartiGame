package com.partigame.games.bulmaca;

import java.util.List;

/**
 * Üretilmiş bir bulmaca. Kelimeler okuma sırasına göre numaralanır; aynı hücreden başlayan
 * soldan sağa ve yukarıdan aşağıya kelimeler aynı numarayı paylaşır.
 */
record Crossword(int rows, int cols, List<Entry> entries) {

    /** {@code across}: true soldan sağa, false yukarıdan aşağıya. */
    record Entry(int id, int number, boolean across, int row, int col, String answer, String clue) {

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
