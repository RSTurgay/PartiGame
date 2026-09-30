package com.partigame.game;

import java.util.List;

/**
 * Bir oyunun lobide oda sahibinin seçebileceği ayarı (örn. tur süresi, zorluk).
 * Seçilen değer oyun başlarken {@link GameContext#option} ile okunur.
 */
public record GameOption(String key, String label, List<Choice> choices, String defaultValue) {

    public record Choice(String value, String label) {
    }

    public boolean allows(String value) {
        return choices.stream().anyMatch(c -> c.value().equals(value));
    }
}
