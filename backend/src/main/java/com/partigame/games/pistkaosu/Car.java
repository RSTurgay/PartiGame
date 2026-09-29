package com.partigame.games.pistkaosu;

final class Car {

    final String playerId;
    double x;
    double y;
    double angle;
    double speed;

    boolean up;
    boolean down;
    boolean left;
    boolean right;

    /** Sıradaki kontrol noktası ve şimdiye kadar geçilen toplam kontrol noktası. */
    int nextCheckpoint;
    int passed;
    boolean onTrack = true;

    boolean finished;
    double finishTime;
    /** Sıralama için; geçilen noktalar + sıradaki noktaya yakınlık. */
    double progress;
    int place;

    Car(String playerId, double x, double y, double angle) {
        this.playerId = playerId;
        this.x = x;
        this.y = y;
        this.angle = angle;
    }
}
