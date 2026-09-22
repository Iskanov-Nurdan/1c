from rest_framework.pagination import PageNumberPagination


class LargePagination(PageNumberPagination):
    """SPA загружает справочники целиком, поэтому страница большая.

    Клиент всё равно идёт по ссылке ``next``, так что ограничение безопасно.
    """

    page_size = 500
    page_size_query_param = 'page_size'
    max_page_size = 5000
