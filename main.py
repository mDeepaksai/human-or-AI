from fastapi import FastAPI
from models import product

app = FastAPI()

@app.get("/")
def geet():
    return "this is server"
product=[
    product(1,"phone",50000,"realme"),
    product(2,"phone",30000,"opp")
    ]
@app.get("/product")
def get_all_products():
    return product