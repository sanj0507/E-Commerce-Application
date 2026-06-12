package com.example.ecommerce.service;

import com.example.ecommerce.model.Cart;
import com.example.ecommerce.model.Product;
import com.example.ecommerce.model.Order;
import com.example.ecommerce.repository.CartRepository;
import com.example.ecommerce.repository.ProductRepository;
import com.example.ecommerce.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EcommerceServiceTest {

    private EcommerceService ecommerceService;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private CartRepository cartRepository;

    @Mock
    private OrderRepository orderRepository;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        ecommerceService = new EcommerceService(productRepository, cartRepository, orderRepository);
    }

    // --- PRODUCT TESTS ---

    @Test
    void testGetProductById_Success() {
        Product product = new Product(1L, "Apple", new BigDecimal("10.00"), 100);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        Optional<Product> found = ecommerceService.getProductById(1L);
        assertTrue(found.isPresent());
        assertEquals("Apple", found.get().getName());
    }

    // --- CART TESTS ---

    @Test
    void testAddProductToCart_Success() {
        Product product = new Product(1L, "Apple", new BigDecimal("10.00"), 100);
        Cart cart = new Cart("cartId");

        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(cartRepository.findById("cartId")).thenReturn(Optional.of(cart));
        when(cartRepository.save(any(Cart.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Cart updated = ecommerceService.addProductToCart("cartId", 1L, 5);
        assertNotNull(updated);
        assertEquals(5, updated.getItems().get(1L));
        verify(cartRepository, times(1)).save(cart);
    }

    @Test
    void testAddProductToCart_ProductNotFound() {
        when(productRepository.findById(1L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> 
            ecommerceService.addProductToCart("cartId", 1L, 5)
        );
    }

    @Test
    void testAddProductToCart_InsufficientStock() {
        Product product = new Product(1L, "Apple", new BigDecimal("10.00"), 3);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        assertThrows(RuntimeException.class, () -> 
            ecommerceService.addProductToCart("cartId", 1L, 5)
        );
    }

    @Test
    void testUpdateProductQuantityInCart_Success() {
        Cart cart = new Cart("cartId");
        cart.addItem(1L, 2);
        Product product = new Product(1L, "Apple", new BigDecimal("10.00"), 10);

        when(cartRepository.findById("cartId")).thenReturn(Optional.of(cart));
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));
        when(cartRepository.save(any(Cart.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Cart updated = ecommerceService.updateProductQuantityInCart("cartId", 1L, 5);
        assertEquals(5, updated.getItems().get(1L));
    }

    @Test
    void testUpdateProductQuantityInCart_RemoveItemWhenQtyZero() {
        Cart cart = new Cart("cartId");
        cart.addItem(1L, 2);

        when(cartRepository.findById("cartId")).thenReturn(Optional.of(cart));
        when(cartRepository.save(any(Cart.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Cart updated = ecommerceService.updateProductQuantityInCart("cartId", 1L, 0);
        assertFalse(updated.getItems().containsKey(1L));
    }

    // --- CHECKOUT TESTS ---

    @Test
    void testCheckout_Success() {
        Cart cart = new Cart("cartId");
        cart.addItem(1L, 2);
        cart.addItem(2L, 3);

        Product p1 = new Product(1L, "Apple", new BigDecimal("10.00"), 10);
        Product p2 = new Product(2L, "Milk", new BigDecimal("50.00"), 5);

        when(cartRepository.findById("cartId")).thenReturn(Optional.of(cart));
        when(productRepository.findById(1L)).thenReturn(Optional.of(p1));
        when(productRepository.findById(2L)).thenReturn(Optional.of(p2));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order order = ecommerceService.checkout("cartId", "Aarav", "aarav@email.com", "New Delhi", "Verdant Pay");

        assertNotNull(order);
        assertEquals("Aarav", order.getCustomerName());
        assertEquals("PAID", order.getStatus());
        // Price: 10 * 2 + 50 * 3 = 170.00
        assertEquals(new BigDecimal("170.00"), order.getTotalAmount());
        assertEquals(8, p1.getStock()); // stock decremented
        assertEquals(2, p2.getStock()); // stock decremented

        verify(productRepository, times(1)).save(p1);
        verify(productRepository, times(1)).save(p2);
        verify(cartRepository, times(1)).deleteById("cartId");
    }

    @Test
    void testCheckout_EmptyCart() {
        when(cartRepository.findById("cartId")).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> 
            ecommerceService.checkout("cartId", "Aarav", "aarav@email.com", "New Delhi", "Verdant Pay")
        );
    }
}
