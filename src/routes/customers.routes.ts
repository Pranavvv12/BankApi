import { Router } from 'express';
import { createCustomer } from '../controllers/customers.controller.js';
import { validate } from '../middlewares/validate.js';
import { createCustomerSchema } from '../schemas/customers.schema.js';

const r = Router();

/**
 * @openapi
 * /customers:
 *   post:
 *     summary: Create a new customer
 *     description: Creates a new customer with name and email
 *     tags: 
 *       - Customers
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 description: Customer's full name (at least 3 characters)
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Customer's email address
 *                 example: "john.doe@example.com"
 *     responses:
 *       201:
 *         description: Customer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 name:
 *                   type: string
 *                   example: "John Doe"
 *                 email:
 *                   type: string
 *                   example: "john.doe@example.com"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 */
r.post('/', validate(createCustomerSchema), createCustomer);
// r.get('/:id/profile', createCustomer);
export default r;
