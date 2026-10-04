"""Documented request field names; mock-only evaluation controls kept separate."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, JsonValue, create_model, field_validator

Scenario = Literal['NORMAL_SERVICEABLE', 'EMBARGO', 'NSZ', 'SHIPMENT_CREATED',
                   'NO_RIDER_OR_CAPACITY', 'TIMEOUT', 'MALFORMED_RESPONSE',
                   'IN_TRANSIT', 'DELIVERED', 'DELIVERY_EXCEPTION']

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, allow_inf_nan=False)

class ShipmentRequired(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    order: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=1, max_length=50)
    add: str = Field(min_length=1, max_length=1000)
    pin: int = Field(ge=100000, le=999999)
    payment_mode: Literal['Pickup', 'COD', 'Prepaid', 'REPL']

    @field_validator('name', 'order', 'phone', 'add')
    @classmethod
    def not_blank(cls, value):
        if not value.strip(): raise ValueError('Required field must not be blank')
        return value

# The supplied documentation does not specify types for these optional fields.
# Preserve names and JSON values instead of asserting invented official types.
OPTIONAL_FIELDS = ('address_type ewbn hsn_code shipping_mode seller_inv city weight '
    'return_name return_address return_city return_phone return_state return_country return_pin '
    'seller_name fragile_shipment shipment_height shipment_width shipment_length cod_amount '
    'products_desc state dangerous_good waybill total_amount seller_add country plastic_packaging '
    'quantity transport_speed return_add order_date').split()
Shipment = create_model('Shipment', __base__=ShipmentRequired,
                        **{name: (JsonValue, None) for name in OPTIONAL_FIELDS})

class PickupLocation(StrictModel):
    name: str = Field(min_length=1, max_length=200)

class Manifest(StrictModel):
    shipments: list[Shipment] = Field(min_length=1, max_length=1)
    pickup_location: PickupLocation

class ServiceabilityInput(StrictModel):
    filter_codes: str = Field(pattern=r'^[1-9][0-9]{5}$')
    simulation_scenario: Scenario | None = None

class CreateInput(StrictModel):
    shipment: Shipment
    pickup_location: PickupLocation
    simulation_scenario: Scenario | None = None

class TrackInput(StrictModel):
    waybill: str = Field(pattern=r'^[0-9]{13}$')
    ref_ids: str | None = Field(default=None, max_length=200)
    simulation_scenario: Scenario | None = None
