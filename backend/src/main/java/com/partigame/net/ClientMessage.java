package com.partigame.net;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.partigame.game.GameMode;

import java.util.Map;

/**
 * İstemciden gelen tüm mesajlar. {@code type} alanına göre diğer alanlardan ilgili olanlar doludur:
 * <ul>
 *   <li>create: name</li>
 *   <li>join: name, code</li>
 *   <li>selectGame: gameId, mode</li>
 *   <li>setTeam: team</li>
 *   <li>start, lobby, leave: (alan yok)</li>
 *   <li>input: input (oyuna özel)</li>
 * </ul>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ClientMessage(String type, String name, String code, String gameId, GameMode mode,
                            Integer team, Map<String, Object> input) {
}
