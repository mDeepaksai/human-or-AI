from fastapi import FastAPI
from models import Product
from typing import List

app = FastAPI()

products: List[Product] = [
    Product(id=1, name="product_1", quantity=2, price=3),
    Product(id=2, name="product_2", quantity=2, price=10),
    Product(id=3, name="product_3", quantity=2, price=20),
    Product(id=4, name="product_4", quantity=2, price=43),
]

@app.get("/")
def hello_world():
    return {"message": "Hello World This is Deepak Sai"}

@app.get("/products")
def get_products():
    return products

@app.get("/products/{id}")
def get_product(id: int):
    for p in products:
        if p.id == id:
            return p
    return {"message": f"Product with id {id} not found"}

@app.post("/products")
def create_product(product: Product):
    products.append(product)
    return product

@app.put("/products/{id}")
def update_product(id: int, product: Product):
    for i in products:
        if i.id == id:
            i.name = product.name
            i.quantity = product.quantity
            i.price = product.price
            return product
    return {"message": f"Product with id {id} not found"}
@app.delete("/products/{id}")
def delete_product(id: int):
    for index, p in enumerate(products):
        if p.id == id:
            del products[index]
            return products
    return {"message": f"Product with id {id} not found"}
