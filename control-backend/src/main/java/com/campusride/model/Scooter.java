package com.campusride.model;

public class Scooter {
    private int id;
    private String name;
    private double lat;
    private double lng;
    private String status;
    private int battery;
    private int speed;

    // Getters and setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public double getLat() { return lat; }
    public void setLat(double lat) { this.lat = lat; }

    public double getLng() { return lng; }
    public void setLng(double lng) { this.lng = lng; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getBattery() { return battery; }
    public void setBattery(int battery) { this.battery = battery; }

    public int getSpeed() { return speed; }
    public void setSpeed(int speed) { this.speed = speed; }
}
