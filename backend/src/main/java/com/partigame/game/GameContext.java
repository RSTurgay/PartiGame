package com.partigame.game;

import java.util.List;
import java.util.Map;

/** Maç başlarken oyuna verilen bilgiler. {@code options}: lobide seçilen oyun ayarları. */
public record GameContext(GameMode mode, List<PlayerInfo> players, Map<String, String> options) {

    public GameContext(GameMode mode, List<PlayerInfo> players) {
        this(mode, players, Map.of());
    }

    public String option(String key, String fallback) {
        return options.getOrDefault(key, fallback);
    }
}
