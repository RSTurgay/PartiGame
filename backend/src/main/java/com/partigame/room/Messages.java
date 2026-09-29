package com.partigame.room;

import com.partigame.game.GameMode;
import com.partigame.game.GameRegistry.GameInfo;

import java.util.List;

/** Sunucudan istemciye giden mesajlar. Her mesajın bir {@code type} alanı vardır. */
public final class Messages {

    private Messages() {
    }

    public record Welcome(String type, List<GameInfo> games) {
        public Welcome(List<GameInfo> games) {
            this("welcome", games);
        }
    }

    public record Joined(String type, String code, String playerId) {
        public Joined(String code, String playerId) {
            this("joined", code, playerId);
        }
    }

    public record RoomState(String type, RoomView room) {
        public RoomState(RoomView room) {
            this("room", room);
        }
    }

    public record GameStarted(String type, String gameId, GameMode mode, Object init) {
        public GameStarted(String gameId, GameMode mode, Object init) {
            this("gameStart", gameId, mode, init);
        }
    }

    public record GameState(String type, Object state) {
        public GameState(Object state) {
            this("state", state);
        }
    }

    public record GameEnded(String type, List<ResultView> results) {
        public GameEnded(List<ResultView> results) {
            this("gameEnd", results);
        }
    }

    public record Error(String type, String message) {
        public Error(String message) {
            this("error", message);
        }
    }

    public record RoomView(String code, String hostId, RoomPhase phase, String gameId, GameMode mode,
                           List<PlayerView> players, List<ResultView> lastResults) {
    }

    /** {@code score}: bu odada oynanan tüm oyunlardan toplanan parti puanı. */
    public record PlayerView(String id, String name, String color, int team, int score) {
    }

    public record ResultView(String playerId, String name, String color, int team,
                             int place, int points, String detail) {
    }
}
