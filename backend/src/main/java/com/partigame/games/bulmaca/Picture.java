package com.partigame.games.bulmaca;

/**
 * Resimli soru. {@code image} frontend public klasöründeki yol; {@code author}, {@code license} ve
 * {@code source} lisans gereği resmin yanında gösterilir (Wikimedia Commons).
 */
record Picture(String answer, String question, String image, String author, String license, String source) {
}
