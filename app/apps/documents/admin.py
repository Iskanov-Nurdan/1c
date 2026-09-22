from django.contrib import admin

from apps.common.admin import BaseAdmin

from .models import Contract, Document, Signature


@admin.register(Document)
class DocumentAdmin(BaseAdmin):
    list_display = ('number', 'type_name', 'date', 'counterparty', 'amount', 'status', 'ocr', 'signed')
    list_filter = ('type', 'status', 'ocr', 'signed', 'company')
    search_fields = ('number', 'ocr_text', 'counterparty__name')
    date_hierarchy = 'date'


@admin.register(Contract)
class ContractAdmin(BaseAdmin):
    list_display = ('number', 'counterparty', 'type', 'date', 'end_date', 'amount', 'status', 'signed')
    list_filter = ('side', 'status', 'signed', 'company')
    search_fields = ('number', 'counterparty__name', 'subject')


@admin.register(Signature)
class SignatureAdmin(BaseAdmin):
    list_display = ('doc_number', 'doc_type', 'signer', 'cert', 'ts', 'valid')
    list_filter = ('valid',)
    search_fields = ('doc_number', 'signer', 'cert')
