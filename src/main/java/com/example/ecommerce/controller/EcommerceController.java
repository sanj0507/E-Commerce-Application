package com.example.ecommerce.controller;

import com.example.ecommerce.model.Cart;
import com.example.ecommerce.model.Product;
import com.example.ecommerce.model.Order;
import com.example.ecommerce.service.EcommerceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ecommerce")
public class EcommerceController {

    private final EcommerceService ecommerceService;

    public EcommerceController(EcommerceService ecommerceService) {
        this.ecommerceService = ecommerceService;
    }

    // --- PRODUCT ENDPOINTS ---

    @GetMapping("/products")
    public ResponseEntity<List<Product>> getAllProducts() {
        return ResponseEntity.ok(ecommerceService.getAllProducts());
    }

    @GetMapping("/products/{id}")
    public ResponseEntity<Product> getProductById(@PathVariable Long id) {
        return ecommerceService.getProductById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/products")
    public ResponseEntity<Product> createProduct(@RequestBody Product product) {
        return ResponseEntity.ok(ecommerceService.createProduct(product));
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<Product> updateProduct(@PathVariable Long id, @RequestBody Product product) {
        try {
            return ResponseEntity.ok(ecommerceService.updateProduct(id, product));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        ecommerceService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }

    // --- CART ENDPOINTS ---

    @PostMapping("/cart/{cartId}/add")
    public ResponseEntity<Cart> addItemToCart(
            @PathVariable String cartId,
            @RequestParam Long productId,
            @RequestParam Integer quantity) {

        Cart updatedCart = ecommerceService.addProductToCart(cartId, productId, quantity);
        return ResponseEntity.ok(updatedCart);
    }

    @PostMapping("/cart/{cartId}/update")
    public ResponseEntity<Cart> updateProductQuantity(
            @PathVariable String cartId,
            @RequestParam Long productId,
            @RequestParam Integer quantity) {

        Cart updatedCart = ecommerceService.updateProductQuantityInCart(cartId, productId, quantity);
        return ResponseEntity.ok(updatedCart);
    }

    @DeleteMapping("/cart/{cartId}/product/{productId}")
    public ResponseEntity<Cart> removeProductFromCart(
            @PathVariable String cartId,
            @PathVariable Long productId) {

        Cart updatedCart = ecommerceService.removeProductFromCart(cartId, productId);
        return ResponseEntity.ok(updatedCart);
    }

    @PostMapping("/cart/{cartId}/clear")
    public ResponseEntity<Void> clearCart(@PathVariable String cartId) {
        ecommerceService.clearCart(cartId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/cart/{cartId}")
    public ResponseEntity<Cart> getCart(@PathVariable String cartId) {
        return ecommerceService.getCart(cartId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // --- CHECKOUT & ORDER ENDPOINTS ---

    @PostMapping("/orders/checkout/{cartId}")
    public ResponseEntity<?> checkout(
            @PathVariable String cartId,
            @RequestBody CheckoutRequest request) {
        try {
            Order order = ecommerceService.checkout(
                    cartId,
                    request.getCustomerName(),
                    request.getCustomerEmail(),
                    request.getShippingAddress(),
                    request.getPaymentMethod()
            );
            return ResponseEntity.ok(order);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/orders")
    public ResponseEntity<List<Order>> getAllOrders() {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(401).build();
        }

        List<Order> allOrders = ecommerceService.getAllOrders();
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (isAdmin) {
            return ResponseEntity.ok(allOrders);
        } else {
            String email = auth.getName();
            List<Order> userOrders = allOrders.stream()
                    .filter(order -> email.equalsIgnoreCase(order.getCustomerEmail()))
                    .toList();
            return ResponseEntity.ok(userOrders);
        }
    }

    @GetMapping("/orders/{id}")
    public ResponseEntity<Order> getOrderById(@PathVariable Long id) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(401).build();
        }

        return ecommerceService.getOrderById(id)
                .map(order -> {
                    boolean isAdmin = auth.getAuthorities().stream()
                            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
                    if (isAdmin || auth.getName().equalsIgnoreCase(order.getCustomerEmail())) {
                        return ResponseEntity.ok(order);
                    }
                    return ResponseEntity.status(403).<Order>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/orders/{id}/status")
    public ResponseEntity<Order> updateOrderStatus(@PathVariable Long id, @RequestParam String status) {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(401).build();
        }

        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!isAdmin) {
            return ResponseEntity.status(403).build();
        }

        try {
            Order updatedOrder = ecommerceService.updateOrderStatus(id, status);
            return ResponseEntity.ok(updatedOrder);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // --- REQUEST & RESPONSE HELPER DTOs ---

    public static class CheckoutRequest {
        private String customerName;
        private String customerEmail;
        private String shippingAddress;
        private String paymentMethod;

        public String getCustomerName() { return customerName; }
        public void setCustomerName(String customerName) { this.customerName = customerName; }

        public String getCustomerEmail() { return customerEmail; }
        public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }

        public String getShippingAddress() { return shippingAddress; }
        public void setShippingAddress(String shippingAddress) { this.shippingAddress = shippingAddress; }

        public String getPaymentMethod() { return paymentMethod; }
        public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    }

    public static class ErrorResponse {
        private String message;
        public ErrorResponse(String message) { this.message = message; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}