package com.partigame.games.pistkaosu;

final class Car {

    /** Bu süreden uzun drift mavi (seviye 1), diğerinden uzunu turuncu (seviye 2) turbo verir. */
    static final double DRIFT_LEVEL_1_SECONDS = 0.8;
    static final double DRIFT_LEVEL_2_SECONDS = 1.6;
    static final double RADIUS = 18;

    final String playerId;
    /** Takım modunda 1'den başlar, diğer modlarda 0. */
    final int team;
    double x;
    double y;
    double angle;
    /** Dünya koordinatında hız vektörü; burnun baktığı yönle aynı olmak zorunda değil (kayma). */
    double vx;
    double vy;
    /** Hızın burun yönündeki ve yandaki bileşenleri (her tick yeniden hesaplanır). */
    double speed;
    double slip;

    boolean up;
    boolean down;
    boolean left;
    boolean right;
    boolean driftHeld;

    boolean drifting;
    /** Drift yönü: -1 sol, 1 sağ. */
    int driftDirection;
    double driftTime;
    /** Kalan turbo süresi (sn). */
    double boost;
    /** Geri sayımda gaza ne kadar süredir basıldığı; roket start için. */
    double throttleHeld;

    /** Elindeki eşya; çark dönerken {@code pendingItem}'da bekler. */
    Item item;
    Item pendingItem;
    double rollTimer;
    boolean itemPressed;
    boolean itemWasPressed;
    /** Muza basınca dönme, buzla donma ve kalkan süreleri (sn). */
    double spinTimer;
    double frozenTimer;
    double shieldTimer;

    /** Sıradaki kontrol noktası ve şimdiye kadar geçilen toplam kontrol noktası. */
    int nextCheckpoint;
    int passed;
    boolean onTrack = true;

    boolean finished;
    double finishTime;
    /** Sıralama için; geçilen noktalar + sıradaki noktaya yakınlık. */
    double progress;
    int place;

    Car(String playerId, int team, double x, double y, double angle) {
        this.playerId = playerId;
        this.team = team;
        this.x = x;
        this.y = y;
        this.angle = angle;
    }

    /** Dönerken ya da donmuşken kontrol edilemez. */
    boolean disabled() {
        return spinTimer > 0 || frozenTimer > 0;
    }

    int steerInput() {
        return (right ? 1 : 0) - (left ? 1 : 0);
    }

    int driftLevel() {
        if (driftTime >= DRIFT_LEVEL_2_SECONDS) {
            return 2;
        }
        return driftTime >= DRIFT_LEVEL_1_SECONDS ? 1 : 0;
    }
}
