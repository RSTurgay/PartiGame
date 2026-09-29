package com.partigame.room;

/** Oyuncuya mesaj göndermenin soyutlaması; WebSocket detayını odadan gizler. */
public interface ClientConnection {

    /** Mesajı JSON olarak gönderir. Thread-safe olmalı. */
    void send(Object message);
}
