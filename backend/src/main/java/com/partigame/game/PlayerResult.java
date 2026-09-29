package com.partigame.game;

/** Bir oyuncunun maç sonucu. {@code detail} oyuna özel kısa bilgi (örn. bitiş süresi). */
public record PlayerResult(String playerId, int place, int points, String detail) {
}
