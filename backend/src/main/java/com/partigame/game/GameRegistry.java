package com.partigame.game;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Spring'in bulduğu tüm {@link GameModule} bean'lerini toplar. */
@Component
public class GameRegistry {

    private final Map<String, GameModule> modules = new LinkedHashMap<>();

    public GameRegistry(List<GameModule> modules) {
        modules.forEach(m -> this.modules.put(m.id(), m));
    }

    public Optional<GameModule> find(String id) {
        return Optional.ofNullable(modules.get(id));
    }

    public List<GameInfo> catalog() {
        return modules.values().stream()
                .map(m -> new GameInfo(m.id(), m.name(), m.description(),
                        m.minPlayers(), m.maxPlayers(), List.copyOf(m.supportedModes())))
                .toList();
    }

    public GameModule first() {
        return modules.values().iterator().next();
    }

    public record GameInfo(String id, String name, String description,
                           int minPlayers, int maxPlayers, List<GameMode> modes) {
    }
}
