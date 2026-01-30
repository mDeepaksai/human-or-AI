from fastapi import FastAPI,Header, HTTPException,Depends,Response
from models import Product
from typing import List

app = FastAPI()
API_KEY = "deepak"

products: List[Product] = [
    Product(id=1, name="product_1", quantity=2, price=3),
    Product(id=2, name="product_2", quantity=2, price=10),
    Product(id=3, name="product_3", quantity=2, price=20),
    Product(id=4, name="product_4", quantity=2, price=43),
]

@app.get("/")
def hello_world():
    return {"message": "Hello World This is Deepak Sai"}

def verify_api_key(api_key: str = Header(..., alias="X-API-Key")):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
@app.get("/products",dependencies=[Depends(verify_api_key)])
def get_products():
    return products

@app.get("/products/{id}",dependencies=[Depends(verify_api_key)])
def get_product(id: int):
    for p in products:
        if p.id == id:
            return p
    return {"message": f"Product with id {id} not found"}

@app.post("/products",dependencies=[Depends(verify_api_key)])
def create_product(product: Product):
    products.append(product)
    return product

@app.put("/products/{id}",dependencies=[Depends(verify_api_key)])
def update_product(id: int, product: Product):
    for i in products:
        if i.id == id:
            i.name = product.name
            i.quantity = product.quantity
            i.price = product.price
            return product
    return {"message": f"Product with id {id} not found"}

@app.head("/products/{id}",dependencies=[Depends(verify_api_key)])
def check_product(id: int):
    for p in products:
        if p.id == id:
            return Response(status_code=200, headers={"X-Product-Exists": "true"})
    return Response(status_code=404)

@app.delete("/products/{id}",dependencies=[Depends(verify_api_key)])
def delete_product(id: int):
    for index, p in enumerate(products):
        if p.id == id:
            del products[index]
            return products
    return {"message": f"Product with id {id} not found"}
