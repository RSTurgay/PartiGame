package com.partigame.room;

import com.partigame.game.GameRegistry;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

@Component
public class RoomManager {

    /** Karışabilecek karakterler (0/O, 1/I) çıkarıldı. */
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 4;

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final SecureRandom random = new SecureRandom();
    private final GameRegistry registry;

    public RoomManager(GameRegistry registry) {
        this.registry = registry;
    }

    public Room create() {
        while (true) {
            String code = randomCode();
            Room room = new Room(code, registry.first(),
                    id -> registry.find(id).orElse(null), scheduler, () -> rooms.remove(code));
            if (rooms.putIfAbsent(code, room) == null) {
                return room;
            }
        }
    }

    public Optional<Room> find(String code) {
        return code == null ? Optional.empty() : Optional.ofNullable(rooms.get(code.trim().toUpperCase()));
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
        }
        return sb.toString();
    }

    @PreDestroy
    void shutdown() {
        scheduler.shutdownNow();
    }
}
