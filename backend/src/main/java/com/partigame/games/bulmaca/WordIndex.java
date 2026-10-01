package com.partigame.games.bulmaca;

import java.util.ArrayList;
import java.util.BitSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Kelimeleri uzunluğa göre gruplar ve her (konum, harf) için hangi kelimelerin uyduğunu bit kümesinde tutar.
 * "3. harfi K, 1. harfi A olan 5 harfli kelimeler" sorusu birkaç bit kümesi kesişimiyle cevaplanır.
 */
final class WordIndex {

    private final Map<Integer, List<String>> byLength = new HashMap<>();
    /** uzunluk → konum → harf → kelime kümesi */
    private final Map<Integer, List<Map<Character, BitSet>>> positions = new HashMap<>();
    private final Map<Integer, BitSet> all = new HashMap<>();

    WordIndex(Iterable<String> words) {
        for (String w : words) {
            List<String> list = byLength.computeIfAbsent(w.length(), l -> new ArrayList<>());
            if (list.contains(w)) {
                continue;
            }
            int id = list.size();
            list.add(w);
            List<Map<Character, BitSet>> pos = positions.computeIfAbsent(w.length(), l -> {
                List<Map<Character, BitSet>> p = new ArrayList<>();
                for (int i = 0; i < l; i++) {
                    p.add(new HashMap<>());
                }
                return p;
            });
            for (int i = 0; i < w.length(); i++) {
                pos.get(i).computeIfAbsent(w.charAt(i), c -> new BitSet()).set(id);
            }
            all.computeIfAbsent(w.length(), l -> new BitSet()).set(id);
        }
    }

    int count(int length) {
        return byLength.getOrDefault(length, List.of()).size();
    }

    String word(int length, int id) {
        return byLength.get(length).get(id);
    }

    /**
     * Desene uyan kelimeler. {@code pattern}: bilinmeyen harf için 0.
     * Dönen küme yeni bir nesnedir, çağıran değiştirebilir.
     */
    BitSet matching(char[] pattern) {
        int length = pattern.length;
        BitSet base = all.get(length);
        if (base == null) {
            return new BitSet();
        }
        BitSet result = (BitSet) base.clone();
        List<Map<Character, BitSet>> pos = positions.get(length);
        for (int i = 0; i < length; i++) {
            if (pattern[i] != 0) {
                BitSet withLetter = pos.get(i).get(pattern[i]);
                if (withLetter == null) {
                    return new BitSet();
                }
                result.and(withLetter);
            }
        }
        return result;
    }
}
