package com.dishpatch.map;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Logger;

/**
 * Loads the staged drop-point map produced by map-source/stage-map-assets.sh.
 * <p>
 * Configure in application.properties:
 *   map.drop-points=classpath:drop-points.json
 */
@Service
public class DropPointService {

    private static final Logger logger = Logger.getLogger(DropPointService.class.getName());

    private final ObjectMapper objectMapper;
    private final Resource source;

    private DropPointMap map;
    private Map<String, DropPointMap.DropPoint> byId = Map.of();

    public DropPointService(
            ObjectMapper objectMapper,
            @Value("${map.drop-points:classpath:drop-points.json}") Resource source
    ) {
        this.objectMapper = objectMapper;
        this.source = source;
    }

    @PostConstruct
    public void load() throws IOException {
        try (InputStream in = source.getInputStream()) {
            this.map = objectMapper.readValue(in, DropPointMap.class);
        }

        // unmarshalls drop points to index
        Map<String, DropPointMap.DropPoint> index = new LinkedHashMap<>();
        for (DropPointMap.DropPoint point : map.dropPoints()) {
            if (index.put(point.id(), point) != null) {
                throw new IllegalStateException(    // rejects duplicate id
                        "Duplicate drop point id: " + point.id());
            }
        }
        this.byId = Map.copyOf(index);

        logger.info("Loaded " + byId.size() + " drop points from "
                + source.getDescription());
    }

    public Optional<DropPointMap.DropPoint> find(String id) {
        return Optional.ofNullable(byId.get(id));
    }

    public List<DropPointMap.DropPoint> all() {
        return map.dropPoints();
    }

    public String frameId() {
        return map.frameId();
    }
}
