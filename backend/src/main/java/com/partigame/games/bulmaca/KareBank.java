package com.partigame.games.bulmaca;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Kare (gazete tipi) bulmacanın kısa ipuçlu kelime bankası ({@code resources/bulmaca/kare-*.json})
 * ve resimli sorular ({@code resimler.json}, Wikimedia Commons'tan açık lisanslı).
 */
@Component
public class KareBank {

    static final List<String> WORD_FILES =
            List.of("kare-kisa.json", "kare-4.json", "kare-5.json", "kare-6.json", "kare-uzun.json");
    private static final String PICTURES = "resimler.json";
    private static final Logger log = LoggerFactory.getLogger(KareBank.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();

    record WordJson(String k, String i) {
    }

    record PictureJson(String cevap, String soru, String dosya, String yazar, String lisans, String kaynak) {
    }

    /** cevap → olası ipuçları */
    private final Map<String, List<String>> clues = new LinkedHashMap<>();
    private final List<Picture> pictures = new ArrayList<>();

    public KareBank() {
        for (String file : WORD_FILES) {
            WordJson[] words = read(file, WordJson[].class);
            if (words == null) {
                continue;
            }
            for (WordJson w : words) {
                String answer = TurkishText.normalize(w.k());
                if (answer.length() < 2 || answer.length() > ClueBank.MAX_LENGTH || !answer.equals(w.k())) {
                    log.warn("Geçersiz kare bulmaca kelimesi atlandı: {}", w.k());
                    continue;
                }
                clues.computeIfAbsent(answer, a -> new ArrayList<>()).add(w.i());
            }
        }
        PictureJson[] pics = read(PICTURES, PictureJson[].class);
        if (pics != null) {
            for (PictureJson p : pics) {
                pictures.add(new Picture(TurkishText.normalize(p.cevap()), p.soru(), p.dosya(), p.yazar(),
                        p.lisans(), p.kaynak()));
            }
        }
        log.info("Kare bulmaca bankası: {} kelime, {} resimli soru", clues.size(), pictures.size());
    }

    Map<String, List<String>> clues() {
        return clues;
    }

    List<Picture> pictures() {
        return pictures;
    }

    private static <T> T read(String file, Class<T> type) {
        try (InputStream in = KareBank.class.getResourceAsStream("/bulmaca/" + file)) {
            return in == null ? null : JSON.readValue(in, type);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
