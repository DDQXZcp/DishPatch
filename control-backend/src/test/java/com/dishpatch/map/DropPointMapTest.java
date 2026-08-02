package com.dishpatch.map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Unmarshalling contract for {@link DropPointMap}.
 *
 * These assert the record binds the exact key names written by
 * map-source/stage-map-assets.sh, so renaming a component here fails loudly
 * rather than silently producing nulls at runtime.
 */
class DropPointMapTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void bindsEveryFieldFromTheStagedShape() throws Exception {
        String json = """
                {
                  "map": "the-hive-landscape-mask-nav2.yaml",
                  "frameId": "map",
                  "resolution": 0.011802,
                  "origin": [0.0, 0.0, 0.0],
                  "dropPoints": [
                    { "id": "T1", "x": 8.911, "y": 9.241, "yaw": 0.0 }
                  ]
                }
                """;

        DropPointMap map = objectMapper.readValue(json, DropPointMap.class);

        assertEquals("the-hive-landscape-mask-nav2.yaml", map.map());
        assertEquals("map", map.frameId());
        assertEquals(0.011802, map.resolution());
        assertEquals(3, map.origin().size());
        assertEquals(1, map.dropPoints().size());

        DropPointMap.DropPoint point = map.dropPoints().get(0);
        assertEquals("T1", point.id());
        assertEquals(8.911, point.x());
        assertEquals(9.241, point.y());
        assertEquals(0.0, point.yaw());
    }

    @Test
    void ignoresKeysItDoesNotKnow() throws Exception {
        // @JsonIgnoreProperties means adding a field to the staged JSON later
        // must not break an older backend.
        String json = """
                {
                  "map": "m.yaml",
                  "frameId": "map",
                  "resolution": 0.1,
                  "origin": [0.0, 0.0, 0.0],
                  "someFutureField": "ignored",
                  "dropPoints": [
                    { "id": "R1", "x": 1.0, "y": 2.0, "yaw": 0.5, "alsoFuture": 7 }
                  ]
                }
                """;

        DropPointMap map = objectMapper.readValue(json, DropPointMap.class);

        assertEquals("R1", map.dropPoints().get(0).id());
        assertEquals(0.5, map.dropPoints().get(0).yaw());
    }

    @Test
    void defaultsMissingYawToZero() throws Exception {
        // The staging script omits yaw when the source has none.
        String json = """
                {
                  "map": "m.yaml",
                  "frameId": "map",
                  "resolution": 0.1,
                  "origin": [0.0, 0.0, 0.0],
                  "dropPoints": [{ "id": "T2", "x": 1.0, "y": 2.0 }]
                }
                """;

        DropPointMap map = objectMapper.readValue(json, DropPointMap.class);

        assertEquals(0.0, map.dropPoints().get(0).yaw());
    }
}
