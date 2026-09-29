package com.partigame.game;

import java.util.List;

/** Maç başlarken oyuna verilen bilgiler. */
public record GameContext(GameMode mode, List<PlayerInfo> players) {
}
