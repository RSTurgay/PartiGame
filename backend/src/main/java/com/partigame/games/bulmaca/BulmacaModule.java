package com.partigame.games.bulmaca;

import com.partigame.game.GameContext;
import com.partigame.game.GameMode;
import com.partigame.game.GameModule;
import com.partigame.game.GameOption;
import com.partigame.game.GameOption.Choice;
import com.partigame.game.GameSession;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

@Component
@Order(2)
public class BulmacaModule implements GameModule {

    static final String OPTION_TIME = "sure";
    static final String OPTION_DIFFICULTY = "zorluk";

    private final ClueBank bank;
    private final Random random = new Random();

    public BulmacaModule(ClueBank bank) {
        this.bank = bank;
    }

    @Override
    public String id() {
        return "bulmaca";
    }

    @Override
    public String name() {
        return "Bulmaca Kapışması";
    }

    @Override
    public String description() {
        return "Sırayla ortak bulmacayı çöz: bildiğini yaz, puanı kap! Çözdüğün harfler rakibe ipucu olur.";
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
    public List<GameOption> options() {
        return List.of(
                new GameOption(OPTION_TIME, "Tur süresi", List.of(
                        new Choice("45", "45 sn"), new Choice("60", "60 sn"), new Choice("90", "90 sn")), "60"),
                new GameOption(OPTION_DIFFICULTY, "Zorluk", Arrays.stream(Difficulty.values())
                        .map(d -> new Choice(d.name(), d.label)).toList(), Difficulty.ORTA.name()));
    }

    @Override
    public GameSession createSession(GameContext context) {
        return new BulmacaSession(context, bank, new Random(random.nextLong()));
    }
}
