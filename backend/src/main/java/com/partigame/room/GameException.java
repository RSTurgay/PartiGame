package com.partigame.room;

/** Kullanıcıya gösterilecek hata; mesajı doğrudan istemciye iletilir. */
public class GameException extends RuntimeException {

    public GameException(String message) {
        super(message);
    }
}
