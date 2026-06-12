package com.example.ecommerce.repository;

import com.example.ecommerce.model.Cart;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CartRepository extends CrudRepository<Cart, String> {
    // Basic Key-Value operations are instantly inherited for free!
}