package com.dishpatch.model;

public class Robot {
    private int id;
    private String name;
    private double x;
    private double y;
    private double yaw;
    private String status;
    private int battery;
    private float speed;
    private String destination;
    private String orderId;

    // Getters and setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public double getX() { return x; }
    public void setX(double x) { this.x = x; }

    public double getY() { return y; }
    public void setY(double y) { this.y = y; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getBattery() { return battery; }
    public void setBattery(int battery) { this.battery = battery; }

    public float getSpeed() { return speed; }
    public void setSpeed(float speed) { this.speed = speed; }

    public double getYaw() { return yaw; }
    public void setYaw(double yaw) { this.yaw = yaw; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
}
