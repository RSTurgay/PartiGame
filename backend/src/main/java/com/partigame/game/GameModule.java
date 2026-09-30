package com.partigame.game;

import java.util.List;
import java.util.Set;

/**
 * Bir mini oyunun tanımı. Yeni oyun eklemek için bu arayüzü uygulayan bir
 * Spring {@code @Component} yazmak yeterli; lobi, oda ve puan sistemi otomatik çalışır.
 */
public interface GameModule {

    /** URL ve mesajlarda kullanılan benzersiz kimlik, örn. "pist-kaosu". */
    String id();

    String name();

    String description();

    int minPlayers();

    int maxPlayers();

    Set<GameMode> supportedModes();

    /** Lobide seçilebilen ayarlar; yoksa boş. */
    default List<GameOption> options() {
        return List.of();
    }

    /** Oyun başlarken çağrılır; her maç için yeni bir oturum döner. */
    GameSession createSession(GameContext context);
}
