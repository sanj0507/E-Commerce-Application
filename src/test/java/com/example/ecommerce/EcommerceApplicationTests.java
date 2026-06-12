package com.example.ecommerce;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("Disabled in pipeline because it requires a running PostgreSQL/Redis instance")
class EcommerceApplicationTests {

	@Test
	void contextLoads() {
	}

}
