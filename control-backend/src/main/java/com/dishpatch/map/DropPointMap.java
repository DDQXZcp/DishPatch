package com.dishpatch.map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * Map record to unmarshal `resources/drop-points.json`
 *
 * @param map        filename of the Nav2 map metadata these poses belong to
 * @param frameId    ROS frame
 * @param resolution floorplan scale, in meters per pixel
 * @param origin     ROS map origin as {@code [x, y, yaw]}
 * @param dropPoints one entry per destination; order carries no meaning, so look
 *                   entries up by {@link DropPoint#id()}
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DropPointMap(
        String map,
        String frameId,
        double resolution,
        List<Double> origin,
        List<DropPoint> dropPoints
) {
    @JsonIgnoreProperties(ignoreUnknown = true) // to avoid jackson errors on recognised keys
    public record DropPoint(String id, double x, double y, double yaw) { }
}
