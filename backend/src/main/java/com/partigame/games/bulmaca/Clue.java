package com.partigame.games.bulmaca;

/** Soru bankasındaki bir ipucu. {@code zorluk}: 1 kolay, 2 orta, 3 zor. */
public record Clue(String cevap, String ipucu, int zorluk) {
}
