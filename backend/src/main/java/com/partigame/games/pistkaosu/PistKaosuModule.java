package com.partigame.games.pistkaosu;

import com.partigame.game.GameContext;
import com.partigame.game.GameMode;
import com.partigame.game.GameModule;
import com.partigame.game.GameSession;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Set;

@Component
public class PistKaosuModule implements GameModule {

    @Override
    public String id() {
        return "pist-kaosu";
    }

    @Override
    public String name() {
        return "Pist Kaosu";
    }

    @Override
    public String description() {
        return "Kuşbakışı yarış: " + PistKaosuSession.LAPS + " turu ilk bitiren kazanır!";
    }

    @Override
    public int minPlayers() {
        return 1;
    }

    @Override
    public int maxPlayers() {
        return 8;
    }

    @Override
    public Set<GameMode> supportedModes() {
        return EnumSet.allOf(GameMode.class);
    }

    @Override
    public GameSession createSession(GameContext context) {
        return new PistKaosuSession(context);
    }
}
