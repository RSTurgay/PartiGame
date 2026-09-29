package com.partigame.games.pistkaosu;

import java.util.ArrayList;
import java.util.List;

/**
 * Kapalı bir pistin orta çizgisi. Kaba kontrol noktalarından Catmull-Rom eğrisiyle
 * sık noktalar üretilir; bu noktalar aynı zamanda tur sayımı için kontrol noktalarıdır.
 * Nokta 0 başlangıç/bitiş çizgisidir.
 */
final class Track {

    static final int WIDTH = 1600;
    static final int HEIGHT = 900;
    static final double TRACK_WIDTH = 130;
    /** Pist kenarındaki bordür; üstünde sürmek pistte sayılır (frontend world.ts ile aynı). */
    static final double CURB_WIDTH = 12;

    private static final double[][] CONTROL = {
            // İlk nokta başlangıç çizgisi: düzlüğün ortasında, arabalar dümdüz başlasın.
            {550, 138}, {800, 130}, {1300, 150}, {1480, 300}, {1450, 480}, {1250, 570},
            {1050, 480}, {850, 560}, {800, 740}, {600, 790}, {300, 760}, {150, 600}, {160, 320},
            {300, 150}
    };
    private static final int SAMPLES_PER_SEGMENT = 10;

    final double[] xs;
    final double[] ys;
    final int size;

    private Track(double[] xs, double[] ys) {
        this.xs = xs;
        this.ys = ys;
        this.size = xs.length;
    }

    static Track standard() {
        int n = CONTROL.length;
        List<double[]> pts = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            double[] p0 = CONTROL[(i - 1 + n) % n];
            double[] p1 = CONTROL[i];
            double[] p2 = CONTROL[(i + 1) % n];
            double[] p3 = CONTROL[(i + 2) % n];
            for (int s = 0; s < SAMPLES_PER_SEGMENT; s++) {
                double t = (double) s / SAMPLES_PER_SEGMENT;
                pts.add(new double[]{catmullRom(p0[0], p1[0], p2[0], p3[0], t),
                        catmullRom(p0[1], p1[1], p2[1], p3[1], t)});
            }
        }
        double[] xs = new double[pts.size()];
        double[] ys = new double[pts.size()];
        for (int i = 0; i < pts.size(); i++) {
            xs[i] = Math.round(pts.get(i)[0]);
            ys[i] = Math.round(pts.get(i)[1]);
        }
        return new Track(xs, ys);
    }

    private static double catmullRom(double p0, double p1, double p2, double p3, double t) {
        double t2 = t * t;
        double t3 = t2 * t;
        return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }

    int wrap(int i) {
        return ((i % size) + size) % size;
    }

    /** (x, y) noktasının i. segmente (nokta i → i+1) uzaklığı. */
    double distanceToSegment(int i, double x, double y) {
        int j = wrap(i + 1);
        double ax = xs[wrap(i)], ay = ys[wrap(i)];
        double dx = xs[j] - ax, dy = ys[j] - ay;
        double len2 = dx * dx + dy * dy;
        double t = len2 == 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    }

    /** Nokta i'deki gidiş yönü (radyan). */
    double heading(int i) {
        int j = wrap(i + 1);
        return Math.atan2(ys[j] - ys[wrap(i)], xs[j] - xs[wrap(i)]);
    }

    List<int[]> points() {
        List<int[]> list = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            list.add(new int[]{(int) xs[i], (int) ys[i]});
        }
        return list;
    }
}
