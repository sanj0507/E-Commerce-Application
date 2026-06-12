package com.example.ecommerce.service;

import com.example.ecommerce.model.Cart;
import com.example.ecommerce.model.Product;
import com.example.ecommerce.model.Order;
import com.example.ecommerce.model.OrderItem;
import com.example.ecommerce.repository.CartRepository;
import com.example.ecommerce.repository.ProductRepository;
import com.example.ecommerce.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class EcommerceService {

    private final ProductRepository productRepository;
    private final CartRepository cartRepository;
    private final OrderRepository orderRepository;

    public EcommerceService(ProductRepository productRepository, CartRepository cartRepository, OrderRepository orderRepository) {
        this.productRepository = productRepository;
        this.cartRepository = cartRepository;
        this.orderRepository = orderRepository;
    }

    // --- PRODUCT CRUD METHODS ---

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    public Optional<Product> getProductById(Long id) {
        return productRepository.findById(id);
    }

    @Transactional
    public Product createProduct(Product product) {
        return productRepository.save(product);
    }

    @Transactional
    public Product updateProduct(Long id, Product productDetails) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found with ID: " + id));
        product.setName(productDetails.getName());
        product.setPrice(productDetails.getPrice());
        product.setStock(productDetails.getStock());
        product.setDescription(productDetails.getDescription());
        product.setImageUrl(productDetails.getImageUrl());
        return productRepository.save(product);
    }

    @Transactional
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
    }

    // --- CART METHODS ---

    public Cart addProductToCart(String cartId, Long productId, Integer quantity) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found with ID: " + productId));

        if (product.getStock() < quantity) {
            throw new RuntimeException("Insufficient stock for product: " + product.getName());
        }

        Cart cart = cartRepository.findById(cartId)
                .orElse(new Cart(cartId));

        cart.addItem(productId, quantity);
        return cartRepository.save(cart);
    }

    public Cart updateProductQuantityInCart(String cartId, Long productId, Integer quantity) {
        Cart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> new RuntimeException("Cart not found with ID: " + cartId));

        if (quantity <= 0) {
            cart.removeItem(productId);
        } else {
            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new RuntimeException("Product not found with ID: " + productId));

            if (product.getStock() < quantity) {
                throw new RuntimeException("Insufficient stock for product: " + product.getName() + ". Max available is " + product.getStock());
            }
            cart.getItems().put(productId, quantity);
        }
        return cartRepository.save(cart);
    }

    public Cart removeProductFromCart(String cartId, Long productId) {
        Cart cart = cartRepository.findById(cartId)
                .orElse(new Cart(cartId));
        cart.removeItem(productId);
        return cartRepository.save(cart);
    }

    public void clearCart(String cartId) {
        cartRepository.deleteById(cartId);
    }

    public Optional<Cart> getCart(String cartId) {
        return cartRepository.findById(cartId);
    }

    // --- ORDER & CHECKOUT METHODS ---

    @Transactional
    public Order checkout(String cartId, String customerName, String customerEmail, String shippingAddress, String paymentMethod) {
        Cart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> new RuntimeException("Cart is empty or does not exist."));

        if (cart.getItems() == null || cart.getItems().isEmpty()) {
            throw new RuntimeException("Cart contains no items.");
        }

        Order order = new Order(customerName, customerEmail, shippingAddress, paymentMethod, BigDecimal.ZERO, LocalDateTime.now(), "PAID");
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (java.util.Map.Entry<Long, Integer> entry : cart.getItems().entrySet()) {
            Long productId = entry.getKey();
            Integer quantity = entry.getValue();

            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new RuntimeException("Product with ID " + productId + " not found."));

            if (product.getStock() < quantity) {
                throw new RuntimeException("Insufficient stock for product " + product.getName() + " (Requested: " + quantity + ", Available: " + product.getStock() + ")");
            }

            // Decrement stock
            product.setStock(product.getStock() - quantity);
            productRepository.save(product);

            // Create order item snapshot
            OrderItem orderItem = new OrderItem(product.getId(), product.getName(), quantity, product.getPrice());
            order.addItem(orderItem);

            // Accumulate total
            BigDecimal itemCost = product.getPrice().multiply(new BigDecimal(quantity));
            totalAmount = totalAmount.add(itemCost);
        }

        order.setTotalAmount(totalAmount);
        Order savedOrder = orderRepository.save(order);

        // Clear the cart in Redis
        cartRepository.deleteById(cartId);

        return savedOrder;
    }

    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }

    public Optional<Order> getOrderById(Long id) {
        return orderRepository.findById(id);
    }
}