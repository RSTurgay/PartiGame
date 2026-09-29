package com.partigame.room;

import com.partigame.game.PlayerInfo;

public class Player {

    private final String id;
    private final String name;
    private final ClientConnection connection;
    private String color;
    private int team;

    public Player(String id, String name, ClientConnection connection) {
        this.id = id;
        this.name = name;
        this.connection = connection;
    }

    public void send(Object message) {
        connection.send(message);
    }

    public PlayerInfo info() {
        return new PlayerInfo(id, name, color, team);
    }

    public String id() {
        return id;
    }

    public String name() {
        return name;
    }

    public String color() {
        return color;
    }

    void setColor(String color) {
        this.color = color;
    }

    public int team() {
        return team;
    }

    void setTeam(int team) {
        this.team = team;
    }
}
