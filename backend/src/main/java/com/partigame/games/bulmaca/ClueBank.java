package com.partigame.games.bulmaca;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;

/** {@code resources/bulmaca/sorular.json} içindeki Türkçe soru bankası. */
@Component
public class ClueBank {

    static final int MIN_LENGTH = 3;
    static final int MAX_LENGTH = 11;
    private static final String RESOURCE = "/bulmaca/sorular.json";
    private static final Logger log = LoggerFactory.getLogger(ClueBank.class);

    private final List<Clue> clues;

    public ClueBank() {
        this(load());
        log.info("Bulmaca soru bankası yüklendi: {} soru", clues.size());
    }

    ClueBank(List<Clue> clues) {
        this.clues = List.copyOf(clues);
    }

    List<Clue> all() {
        return clues;
    }

    /** Cevapları normalleştirir; kurala uymayan (harf dışı, çok kısa/uzun) soruları atar. */
    static List<Clue> load() {
        try (InputStream in = ClueBank.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException(RESOURCE + " bulunamadı");
            }
            Clue[] raw = JsonMapper.builder().build().readValue(in, Clue[].class);
            List<Clue> valid = new ArrayList<>();
            for (Clue c : raw) {
                String answer = TurkishText.normalize(c.cevap());
                if (answer.length() < MIN_LENGTH || answer.length() > MAX_LENGTH || !answer.equals(c.cevap())) {
                    log.warn("Geçersiz bulmaca sorusu atlandı: {}", c.cevap());
                    continue;
                }
                valid.add(c);
            }
            return valid;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
