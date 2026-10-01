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
    static final String OPTION_STYLE = "tip";
    static final String STYLE_KARE = "KARE";
    static final String STYLE_KLASIK = "KLASIK";

    private final ClueBank bank;
    private final KareBank kareBank;
    private final Random random = new Random();

    public BulmacaModule(ClueBank bank, KareBank kareBank) {
        this.bank = bank;
        this.kareBank = kareBank;
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
                new GameOption(OPTION_STYLE, "Bulmaca tipi", List.of(
                        new Choice(STYLE_KARE, "Gazete (kare)"), new Choice(STYLE_KLASIK, "Klasik")), STYLE_KARE),
                new GameOption(OPTION_TIME, "Tur süresi", List.of(
                        new Choice("45", "45 sn"), new Choice("60", "60 sn"), new Choice("90", "90 sn")), "60"),
                new GameOption(OPTION_DIFFICULTY, "Zorluk (klasik)", Arrays.stream(Difficulty.values())
                        .map(d -> new Choice(d.name(), d.label)).toList(), Difficulty.ORTA.name()));
    }

    @Override
    public GameSession createSession(GameContext context) {
        return new BulmacaSession(context, bank, kareBank, new Random(random.nextLong()));
    }
}
