package com.partigame.game;

/** Oyunların gördüğü oyuncu bilgisi. {@code team} takım modunda 1'den başlar, diğer modlarda 0'dır. */
public record PlayerInfo(String id, String name, String color, int team) {
}
