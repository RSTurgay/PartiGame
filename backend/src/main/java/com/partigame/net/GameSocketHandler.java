package com.partigame.net;

import com.partigame.game.GameRegistry;
import com.partigame.room.ClientConnection;
import com.partigame.room.GameException;
import com.partigame.room.Messages;
import com.partigame.room.Player;
import com.partigame.room.Room;
import com.partigame.room.RoomManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class GameSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(GameSocketHandler.class);
    private static final int SEND_TIME_LIMIT_MS = 2000;
    private static final int SEND_BUFFER_BYTES = 256 * 1024;
    private static final int MAX_NAME_LENGTH = 16;

    private final JsonMapper json = JsonMapper.builder().build();
    private final Map<String, Client> clients = new ConcurrentHashMap<>();
    private final RoomManager rooms;
    private final GameRegistry games;

    public GameSocketHandler(RoomManager rooms, GameRegistry games) {
        this.rooms = rooms;
        this.games = games;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Client client = new Client(UUID.randomUUID().toString().substring(0, 8),
                new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, SEND_BUFFER_BYTES));
        clients.put(session.getId(), client);
        client.send(new Messages.Welcome(games.catalog()));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Client client = clients.get(session.getId());
        if (client == null) {
            return;
        }
        try {
            handle(client, json.readValue(message.getPayload(), ClientMessage.class));
        } catch (GameException e) {
            client.send(new Messages.Error(e.getMessage()));
        } catch (JacksonException e) {
            client.send(new Messages.Error("Geçersiz mesaj."));
        }
    }

    private void handle(Client client, ClientMessage msg) {
        if (msg.type() == null) {
            throw new GameException("Mesaj tipi eksik.");
        }
        switch (msg.type()) {
            case "create" -> enter(client, rooms.create(), msg.name());
            case "join" -> enter(client, rooms.find(msg.code())
                    .orElseThrow(() -> new GameException("Oda bulunamadı.")), msg.name());
            case "leave" -> leaveRoom(client);
            case "selectGame" -> room(client).selectGame(client.playerId, msg.gameId(), msg.mode());
            case "setTeam" -> room(client).setTeam(client.playerId, msg.team() == null ? 0 : msg.team());
            case "start" -> room(client).start(client.playerId);
            case "lobby" -> room(client).backToLobby(client.playerId);
            case "input" -> room(client).input(client.playerId, msg.input());
            default -> throw new GameException("Bilinmeyen mesaj: " + msg.type());
        }
    }

    private void enter(Client client, Room room, String rawName) {
        leaveRoom(client);
        room.join(new Player(client.playerId, cleanName(rawName), client));
        client.room = room;
    }

    private void leaveRoom(Client client) {
        Room room = client.room;
        if (room != null) {
            client.room = null;
            room.leave(client.playerId);
        }
    }

    private Room room(Client client) {
        Room room = client.room;
        if (room == null) {
            throw new GameException("Önce bir odaya katıl.");
        }
        return room;
    }

    private static String cleanName(String raw) {
        String name = raw == null ? "" : raw.strip().replaceAll("\\s+", " ");
        if (name.isEmpty()) {
            return "Oyuncu";
        }
        return name.length() > MAX_NAME_LENGTH ? name.substring(0, MAX_NAME_LENGTH) : name;
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Client client = clients.remove(session.getId());
        if (client != null) {
            leaveRoom(client);
        }
    }

    private final class Client implements ClientConnection {
        private final String playerId;
        private final WebSocketSession socket;
        private volatile Room room;

        private Client(String playerId, WebSocketSession socket) {
            this.playerId = playerId;
            this.socket = socket;
        }

        @Override
        public void send(Object message) {
            if (!socket.isOpen()) {
                return;
            }
            try {
                socket.sendMessage(new TextMessage(json.writeValueAsString(message)));
            } catch (IOException | IllegalStateException e) {
                log.debug("Oyuncu {} için mesaj gönderilemedi: {}", playerId, e.getMessage());
            }
        }
    }
}
