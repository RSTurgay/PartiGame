package com.partigame.game;

import java.util.List;
import java.util.Map;

/**
 * Tek bir maçın sunucu tarafı mantığı. Tüm metotlar oda kilidi altında,
 * tek thread'den çağrılır; implementasyonların thread-safe olmasına gerek yok.
 */
public interface GameSession {

    /** Oyun başlarken istemcilere bir kez gönderilen sabit veri (harita, kurallar...). */
    Object initData();

    /** Oyuncudan gelen girdi; içeriği oyuna özeldir. */
    void onInput(String playerId, Map<String, Object> input);

    void onPlayerLeft(String playerId);

    /** Sabit aralıklarla çağrılır. {@code dt} saniye cinsindendir. */
    void update(double dt);

    /** Her tick sonrası istemcilere yayınlanan anlık durum. */
    Object snapshot();

    boolean isFinished();

    /** {@link #isFinished()} true olduktan sonra çağrılır; sıralı sonuç listesi. */
    List<PlayerResult> results();
}
