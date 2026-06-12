package com.example.ecommerce.config;

import com.example.ecommerce.model.Product;
import com.example.ecommerce.model.User;
import com.example.ecommerce.repository.ProductRepository;
import com.example.ecommerce.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Arrays;

@Component
public class DataSeeder implements CommandLineRunner {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public DataSeeder(ProductRepository productRepository, UserRepository userRepository) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        // Only seed products if the repository is empty
        if (productRepository.count() == 0) {
            Product p1 = new Product(null, "Organic Apples (1kg)", new BigDecimal("180.00"), 100, 
                "Crisp, sweet organic apples freshly picked from Himachal orchards.", "/images/organic_apples.png");
            Product p2 = new Product(null, "Fresh Milk (1L)", new BigDecimal("65.00"), 150, 
                "Pure farm-fresh whole milk, pasteurized and homogenized daily.", "/images/fresh_milk.png");
            Product p3 = new Product(null, "Basmati Rice (5kg)", new BigDecimal("490.00"), 40, 
                "Premium long-grain aged aromatic Basmati rice for perfect biryani.", "/images/basmati_rice.png");

            productRepository.saveAll(Arrays.asList(p1, p2, p3));
            System.out.println(">>> Database successfully seeded with 3 fresh grocery products! <<<");
        }

        // Only seed users if the repository is empty
        if (userRepository.count() == 0) {
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
            
            User admin = new User(
                "admin@verdantprovisions.com",
                encoder.encode("adminpassword"),
                "Admin User",
                "ROLE_ADMIN",
                "LOCAL",
                null
            );

            User customer = new User(
                "user@verdantprovisions.com",
                encoder.encode("userpassword"),
                "John User",
                "ROLE_USER",
                "LOCAL",
                null
            );

            userRepository.saveAll(Arrays.asList(admin, customer));
            System.out.println(">>> Database successfully seeded with default testing Admin and Customer accounts! <<<");
        }
    }
}