package com.example.ecommerce.controller;

import com.example.ecommerce.model.Cart;
import com.example.ecommerce.model.Product;
import com.example.ecommerce.model.Order;
import com.example.ecommerce.service.EcommerceService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EcommerceControllerTest {

    private MockMvc mockMvc;

    @Mock
    private EcommerceService ecommerceService;

    @InjectMocks
    private EcommerceController ecommerceController;


    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        this.mockMvc = MockMvcBuilders.standaloneSetup(ecommerceController).build();
    }

    // --- PRODUCT APIS ---

    @Test
    void testGetAllProducts_Success() throws Exception {
        Product p1 = new Product(1L, "Apples", new BigDecimal("100.00"), 10);
        Product p2 = new Product(2L, "Milk", new BigDecimal("50.00"), 20);
        List<Product> products = Arrays.asList(p1, p2);

        when(ecommerceService.getAllProducts()).thenReturn(products);

        mockMvc.perform(get("/api/ecommerce/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].name", is("Apples")))
                .andExpect(jsonPath("$[1].name", is("Milk")));
    }

    @Test
    void testGetProductById_Success() throws Exception {
        Product p1 = new Product(1L, "Apples", new BigDecimal("100.00"), 10);
        when(ecommerceService.getProductById(1L)).thenReturn(Optional.of(p1));

        mockMvc.perform(get("/api/ecommerce/products/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("Apples")))
                .andExpect(jsonPath("$.price", is(100.00)));
    }

    @Test
    void testGetProductById_NotFound() throws Exception {
        when(ecommerceService.getProductById(1L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/ecommerce/products/1"))
                .andExpect(status().isNotFound());
    }

    // --- CART APIS ---

    @Test
    void testAddItemToCart_Success() throws Exception {
        Cart cart = new Cart("cartId");
        cart.addItem(1L, 3);
        when(ecommerceService.addProductToCart("cartId", 1L, 3)).thenReturn(cart);

        mockMvc.perform(post("/api/ecommerce/cart/cartId/add")
                        .param("productId", "1")
                        .param("quantity", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is("cartId")));
    }

    @Test
    void testGetCart_Success() throws Exception {
        Cart cart = new Cart("cartId");
        when(ecommerceService.getCart("cartId")).thenReturn(Optional.of(cart));

        mockMvc.perform(get("/api/ecommerce/cart/cartId"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is("cartId")));
    }

    @Test
    void testGetCart_NotFound() throws Exception {
        when(ecommerceService.getCart("cartId")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/ecommerce/cart/cartId"))
                .andExpect(status().isNotFound());
    }

    // --- CHECKOUT APIS ---

    @Test
    void testCheckout_Success() throws Exception {
        Order order = new Order("Aarav", "aarav@email.com", "New Delhi", "Verdant Pay", new BigDecimal("150.00"), LocalDateTime.now(), "ORDER_PLACED");
        order.setId(1L);

        when(ecommerceService.checkout(eq("cartId"), eq("Aarav"), eq("aarav@email.com"), eq("New Delhi"), eq("Verdant Pay")))
                .thenReturn(order);

        String jsonPayload = "{\"customerName\":\"Aarav\",\"customerEmail\":\"aarav@email.com\",\"shippingAddress\":\"New Delhi\",\"paymentMethod\":\"Verdant Pay\"}";

        mockMvc.perform(post("/api/ecommerce/orders/checkout/cartId")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(1)))
                .andExpect(jsonPath("$.customerName", is("Aarav")));
    }

    @Test
    void testCheckout_BadRequest_Exception() throws Exception {
        when(ecommerceService.checkout(any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("Stock insufficient"));

        String jsonPayload = "{\"customerName\":\"Aarav\",\"customerEmail\":\"aarav@email.com\",\"shippingAddress\":\"New Delhi\",\"paymentMethod\":\"Verdant Pay\"}";

        mockMvc.perform(post("/api/ecommerce/orders/checkout/cartId")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Stock insufficient")));
    }

    @Test
    void testUpdateOrderStatus_Success() throws Exception {
        Order order = new Order("Aarav", "aarav@email.com", "New Delhi", "Verdant Pay", new BigDecimal("150.00"), LocalDateTime.now(), "ORDER_READY");
        order.setId(1L);

        // Mock security context since updateOrderStatus checks authentication
        org.springframework.security.core.Authentication auth = mock(org.springframework.security.core.Authentication.class);
        when(auth.isAuthenticated()).thenReturn(true);
        when(auth.getPrincipal()).thenReturn("admin@email.com");
        
        // Mock ROLE_ADMIN authority
        org.springframework.security.core.authority.SimpleGrantedAuthority authority = new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN");
        doReturn(Arrays.asList(authority)).when(auth).getAuthorities();

        org.springframework.security.core.context.SecurityContext securityContext = mock(org.springframework.security.core.context.SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(auth);
        org.springframework.security.core.context.SecurityContextHolder.setContext(securityContext);

        when(ecommerceService.updateOrderStatus(eq(1L), eq("ORDER_READY"))).thenReturn(order);

        mockMvc.perform(put("/api/ecommerce/orders/1/status")
                        .param("status", "ORDER_READY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(1)))
                .andExpect(jsonPath("$.status", is("ORDER_READY")));
                
        // Clear security context after test
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }
}
