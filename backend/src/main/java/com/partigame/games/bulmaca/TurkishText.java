package com.partigame.games.bulmaca;

import java.util.Locale;

/** Türkçe cevap karşılaştırması: büyük harfe Türkçe kurallarla çevirir (i→İ, ı→I), harf dışını atar. */
final class TurkishText {

    static final Locale TR = Locale.forLanguageTag("tr");

    private TurkishText() {
    }

    static String normalize(String text) {
        if (text == null) {
            return "";
        }
        String upper = text.toUpperCase(TR);
        StringBuilder sb = new StringBuilder(upper.length());
        for (int i = 0; i < upper.length(); i++) {
            char c = upper.charAt(i);
            if (Character.isLetter(c)) {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
