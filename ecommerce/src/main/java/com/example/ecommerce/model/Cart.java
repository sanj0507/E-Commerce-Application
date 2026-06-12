package com.example.ecommerce.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

// This annotation tells Spring Data Redis to save this object as a Hash inside Redis
// "timeToLive = 3600" means the cart automatically deletes itself after 1 hour (3600 seconds) of inactivity!
@RedisHash(value = "carts", timeToLive = 3600)
public class Cart implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    private String id; // This will be the unique Session ID or User ID

    // Maps Product ID -> Quantity purchased
    private Map<Long, Integer> items = new HashMap<>();

    public Cart() {}

    public Cart(String id) {
        this.id = id;
    }

    // Helper methods to manage cart actions
    public void addItem(Long productId, Integer quantity) {
        this.items.put(productId, this.items.getOrDefault(productId, 0) + quantity);
    }

    public void removeItem(Long productId) {
        this.items.remove(productId);
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Map<Long, Integer> getItems() { return items; }
    public void setItems(Map<Long, Integer> items) { this.items = items; }
}